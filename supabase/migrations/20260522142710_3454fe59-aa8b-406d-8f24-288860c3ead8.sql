
-- Simplificar políticas de INSERT removendo o check user_is_active (causa falsos negativos)
-- Todo novo usuário já é criado com status 'ativo' via trigger handle_new_user

DROP POLICY IF EXISTS "Active users insert own companies" ON public.companies;
CREATE POLICY "Authenticated users insert own companies"
ON public.companies FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "Active users insert own folders" ON public.company_folders;
CREATE POLICY "Authenticated users insert own folders"
ON public.company_folders FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "Active users insert tags" ON public.tags;
CREATE POLICY "Authenticated users insert tags"
ON public.tags FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "Owner insert company_tags" ON public.company_tags;
CREATE POLICY "Owner insert company_tags"
ON public.company_tags FOR INSERT TO authenticated
WITH CHECK (user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Owner insert fiscal" ON public.fiscal_movement;
CREATE POLICY "Owner insert fiscal"
ON public.fiscal_movement FOR INSERT TO authenticated
WITH CHECK (user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Owner insert custom_columns" ON public.custom_columns;
CREATE POLICY "Owner insert custom_columns"
ON public.custom_columns FOR INSERT TO authenticated
WITH CHECK (user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Owner insert custom_column_values" ON public.custom_column_values;
CREATE POLICY "Owner insert custom_column_values"
ON public.custom_column_values FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.fiscal_movement m
  WHERE m.id = movement_id AND user_has_company_access(auth.uid(), m.company_id)
));
