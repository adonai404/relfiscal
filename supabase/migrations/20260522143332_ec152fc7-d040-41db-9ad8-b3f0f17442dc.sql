-- Harden company creation against RLS failures during imports

-- 1) Remove duplicated fiscal config trigger if both names exist.
DROP TRIGGER IF EXISTS create_fiscal_config_trigger ON public.companies;
DROP TRIGGER IF EXISTS create_default_fiscal_config_trigger ON public.companies;
CREATE TRIGGER create_default_fiscal_config_trigger
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.create_default_fiscal_config();

-- 2) Normalize ownership before RLS WITH CHECK is evaluated.
CREATE OR REPLACE FUNCTION public.set_company_owner_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NOT NULL THEN
    IF NEW.created_by IS NULL OR NOT public.is_super_admin(current_user_id) THEN
      NEW.created_by := current_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_company_owner_on_insert_trigger ON public.companies;
CREATE TRIGGER set_company_owner_on_insert_trigger
BEFORE INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.set_company_owner_on_insert();

-- 3) Make the INSERT policies deterministic and tolerant of the ownership trigger.
DROP POLICY IF EXISTS "Authenticated users insert own companies" ON public.companies;
DROP POLICY IF EXISTS "Active users insert own companies" ON public.companies;
DROP POLICY IF EXISTS "Super admin insert companies" ON public.companies;

CREATE POLICY "Authenticated users create own companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
);

CREATE POLICY "Super admins create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
);

-- 4) Safe import helper: returns existing accessible company by normalized CNPJ or creates one for the authenticated user.
CREATE OR REPLACE FUNCTION public.get_or_create_import_company(
  _cnpj text,
  _razao_social text DEFAULT 'A definir',
  _nome_fantasia text DEFAULT NULL,
  _uf text DEFAULT 'SP',
  _regime public.tax_regime DEFAULT 'simples_nacional'
)
RETURNS TABLE(id uuid, cnpj text, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  normalized_cnpj text := regexp_replace(coalesce(_cnpj, ''), '\D', '', 'g');
  found_company public.companies%ROWTYPE;
  created_company public.companies%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF normalized_cnpj = '' THEN
    RAISE EXCEPTION 'CNPJ inválido';
  END IF;

  SELECT *
  INTO found_company
  FROM public.companies c
  WHERE regexp_replace(c.cnpj, '\D', '', 'g') = normalized_cnpj
    AND public.user_has_company_access(current_user_id, c.id)
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    id := found_company.id;
    cnpj := found_company.cnpj;
    created := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT *
  INTO found_company
  FROM public.companies c
  WHERE regexp_replace(c.cnpj, '\D', '', 'g') = normalized_cnpj
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'CNPJ já existe no sistema, mas não está vinculado ao usuário atual: %', found_company.cnpj;
  END IF;

  INSERT INTO public.companies (
    cnpj,
    razao_social,
    nome_fantasia,
    uf,
    regime,
    slug,
    created_by
  ) VALUES (
    normalized_cnpj,
    nullif(trim(coalesce(_razao_social, 'A definir')), ''),
    coalesce(nullif(trim(_nome_fantasia), ''), nullif(trim(coalesce(_razao_social, '')), ''), 'Empresa ' || right(normalized_cnpj, 4)),
    coalesce(nullif(trim(_uf), ''), 'SP'),
    coalesce(_regime, 'simples_nacional'::public.tax_regime),
    '',
    current_user_id
  )
  RETURNING * INTO created_company;

  id := created_company.id;
  cnpj := created_company.cnpj;
  created := true;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_import_company(text, text, text, text, public.tax_regime) TO authenticated;

-- 5) Optional hardening: ownership should no longer be nullable for new rows once backfilled.
UPDATE public.companies
SET created_by = auth.uid()
WHERE false;
