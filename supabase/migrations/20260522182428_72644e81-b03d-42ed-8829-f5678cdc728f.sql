
-- Helper: usuário pode LER (inclui acesso via cliente vinculado)
CREATE OR REPLACE FUNCTION public.user_can_read_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_has_company_access(_user_id, _company_id)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.customer_companies cc ON cc.customer_id = p.customer_id
      WHERE p.user_id = _user_id
        AND cc.company_id = _company_id
        AND p.customer_id IS NOT NULL
    );
$$;

-- Helper: usuário é cliente do portal (somente leitura)
CREATE OR REPLACE FUNCTION public.is_portal_customer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND customer_id IS NOT NULL
  ) AND NOT public.is_super_admin(_user_id);
$$;

-- companies SELECT
DROP POLICY IF EXISTS "Users can view accessible companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view companies via customer link" ON public.companies;
CREATE POLICY "Users can view accessible companies"
  ON public.companies FOR SELECT
  USING (public.user_can_read_company(auth.uid(), id));

-- fiscal_movement SELECT
DROP POLICY IF EXISTS "Users can view movements of accessible companies" ON public.fiscal_movement;
CREATE POLICY "Users can view movements of accessible companies"
  ON public.fiscal_movement FOR SELECT
  USING (public.user_can_read_company(auth.uid(), company_id));

-- fiscal_config SELECT
DROP POLICY IF EXISTS "Users can view fiscal config of accessible companies" ON public.fiscal_config;
CREATE POLICY "Users can view fiscal config of accessible companies"
  ON public.fiscal_config FOR SELECT
  USING (public.user_can_read_company(auth.uid(), company_id));

-- custom_columns SELECT
DROP POLICY IF EXISTS "Users can view custom columns of accessible companies" ON public.custom_columns;
CREATE POLICY "Users can view custom columns of accessible companies"
  ON public.custom_columns FOR SELECT
  USING (public.user_can_read_company(auth.uid(), company_id));

-- custom_column_values SELECT
DROP POLICY IF EXISTS "Users can view custom values of accessible companies" ON public.custom_column_values;
CREATE POLICY "Users can view custom values of accessible companies"
  ON public.custom_column_values FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.fiscal_movement m
    WHERE m.id = custom_column_values.movement_id
      AND public.user_can_read_company(auth.uid(), m.company_id)
  ));

-- company_tags SELECT
DROP POLICY IF EXISTS "Users can view company tags of accessible companies" ON public.company_tags;
CREATE POLICY "Users can view company tags of accessible companies"
  ON public.company_tags FOR SELECT
  USING (public.user_can_read_company(auth.uid(), company_id));
