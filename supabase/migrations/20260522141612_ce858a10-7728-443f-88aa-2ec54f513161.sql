
-- 1) Trigger: criar profile + role 'user' ao criar conta em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Trigger: gerar slug ao inserir company sem slug
DROP TRIGGER IF EXISTS set_company_slug_trigger ON public.companies;
CREATE TRIGGER set_company_slug_trigger
BEFORE INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_company_slug();

-- 3) Trigger: criar fiscal_config padrão ao criar company
DROP TRIGGER IF EXISTS create_default_fiscal_config_trigger ON public.companies;
CREATE TRIGGER create_default_fiscal_config_trigger
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.create_default_fiscal_config();

-- 4) Trigger: updated_at em tabelas relevantes
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fiscal_movement_updated_at ON public.fiscal_movement;
CREATE TRIGGER update_fiscal_movement_updated_at
BEFORE UPDATE ON public.fiscal_movement
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fiscal_config_updated_at ON public.fiscal_config;
CREATE TRIGGER update_fiscal_config_updated_at
BEFORE UPDATE ON public.fiscal_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_columns_updated_at_trigger ON public.custom_columns;
CREATE TRIGGER update_custom_columns_updated_at_trigger
BEFORE UPDATE ON public.custom_columns
FOR EACH ROW EXECUTE FUNCTION public.update_custom_columns_updated_at();

DROP TRIGGER IF EXISTS update_custom_column_values_updated_at ON public.custom_column_values;
CREATE TRIGGER update_custom_column_values_updated_at
BEFORE UPDATE ON public.custom_column_values
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tags_updated_at_trigger ON public.tags;
CREATE TRIGGER update_tags_updated_at_trigger
BEFORE UPDATE ON public.tags
FOR EACH ROW EXECUTE FUNCTION public.update_tags_updated_at();

DROP TRIGGER IF EXISTS update_folders_updated_at ON public.company_folders;
CREATE TRIGGER update_folders_updated_at
BEFORE UPDATE ON public.company_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Backfill: profiles para usuários auth sem profile
INSERT INTO public.profiles (user_id, email, username, approved, status)
SELECT u.id, u.email,
       COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
       true, 'ativo'
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;

-- 6) Backfill: role 'user' para usuários sem nenhuma role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.id IS NULL;
