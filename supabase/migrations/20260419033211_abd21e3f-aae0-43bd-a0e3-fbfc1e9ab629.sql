
-- Funções auxiliares
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND status = 'ativo'
  )
$$;

-- Trigger handle_new_user atualizado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, username, approved, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    true,
    'ativo'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Limpar admins antigos e definir super_admin
DELETE FROM public.user_roles WHERE role IN ('admin', 'super_admin');

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE u.email = 'adonaypereira2121@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id);

-- Garante que todos os perfis existentes estejam aprovados e ativos
UPDATE public.profiles SET approved = true WHERE approved = false;

-- Remover vínculo legado
DROP TRIGGER IF EXISTS link_creator_to_company_trigger ON public.companies;
DROP FUNCTION IF EXISTS public.link_creator_to_company();

-- Reescrever user_has_company_access
CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND created_by = _user_id
  )
  OR public.is_super_admin(_user_id)
$$;

DROP TABLE IF EXISTS public.user_companies CASCADE;

-- RLS companies
DROP POLICY IF EXISTS "Authenticated approved users can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Members or admin delete companies" ON public.companies;
DROP POLICY IF EXISTS "Members or admin update companies" ON public.companies;
DROP POLICY IF EXISTS "Public can read companies" ON public.companies;

CREATE POLICY "Public read companies"
ON public.companies FOR SELECT USING (true);

CREATE POLICY "Active users insert own companies"
ON public.companies FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND public.user_is_active(auth.uid())
);

CREATE POLICY "Owner or super_admin update companies"
ON public.companies FOR UPDATE
USING (created_by = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Owner or super_admin delete companies"
ON public.companies FOR DELETE
USING (created_by = auth.uid() OR public.is_super_admin(auth.uid()));

-- RLS fiscal_movement
DROP POLICY IF EXISTS "Members delete fiscal" ON public.fiscal_movement;
DROP POLICY IF EXISTS "Members insert fiscal" ON public.fiscal_movement;
DROP POLICY IF EXISTS "Members update fiscal" ON public.fiscal_movement;
DROP POLICY IF EXISTS "Public read fiscal" ON public.fiscal_movement;

CREATE POLICY "Public read fiscal"
ON public.fiscal_movement FOR SELECT USING (true);

CREATE POLICY "Owner insert fiscal"
ON public.fiscal_movement FOR INSERT
WITH CHECK (
  public.user_has_company_access(auth.uid(), company_id)
  AND public.user_is_active(auth.uid())
);

CREATE POLICY "Owner update fiscal"
ON public.fiscal_movement FOR UPDATE
USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Owner delete fiscal"
ON public.fiscal_movement FOR DELETE
USING (public.user_has_company_access(auth.uid(), company_id));

-- RLS fiscal_config
DROP POLICY IF EXISTS "Members insert fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "Members update fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "Public read fiscal_config" ON public.fiscal_config;

CREATE POLICY "Public read fiscal_config"
ON public.fiscal_config FOR SELECT USING (true);

CREATE POLICY "Owner insert fiscal_config"
ON public.fiscal_config FOR INSERT
WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Owner update fiscal_config"
ON public.fiscal_config FOR UPDATE
USING (public.user_has_company_access(auth.uid(), company_id));

-- RLS profiles (super_admin no lugar de admin)
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;

CREATE POLICY "Super admin view all profiles"
ON public.profiles FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin update any profile"
ON public.profiles FOR UPDATE
USING (public.is_super_admin(auth.uid()));

-- RLS user_roles
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;

CREATE POLICY "Super admin manage roles"
ON public.user_roles FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin view all roles"
ON public.user_roles FOR SELECT
USING (public.is_super_admin(auth.uid()));
