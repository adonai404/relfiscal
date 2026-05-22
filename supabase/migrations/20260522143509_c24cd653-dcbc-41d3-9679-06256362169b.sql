-- Final hardening for company ownership and SECURITY DEFINER execution

ALTER TABLE public.companies
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.companies
ALTER COLUMN created_by SET NOT NULL;

REVOKE EXECUTE ON FUNCTION public.set_company_owner_on_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_company_owner_on_insert() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_import_company(text, text, text, text, public.tax_regime) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_import_company(text, text, text, text, public.tax_regime) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_import_company(text, text, text, text, public.tax_regime) TO authenticated;
