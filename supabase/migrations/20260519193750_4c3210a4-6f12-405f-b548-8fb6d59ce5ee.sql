-- Update fiscal_config policies
DROP POLICY IF EXISTS "Public read fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "Users can view fiscal config of accessible companies" ON public.fiscal_config;
CREATE POLICY "Users can view fiscal config of accessible companies" 
ON public.fiscal_config FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id));

-- Update custom_columns policies
DROP POLICY IF EXISTS "Public read custom_columns" ON public.custom_columns;
DROP POLICY IF EXISTS "Users can view custom columns of accessible companies" ON public.custom_columns;
CREATE POLICY "Users can view custom columns of accessible companies" 
ON public.custom_columns FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id));

-- Update custom_column_values policies
DROP POLICY IF EXISTS "Public read custom_column_values" ON public.custom_column_values;
CREATE POLICY "Users can view custom values of accessible companies" 
ON public.custom_column_values FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.fiscal_movement m
    WHERE m.id = custom_column_values.movement_id 
    AND user_has_company_access(auth.uid(), m.company_id)
  )
);

-- Update company_tags policies
DROP POLICY IF EXISTS "Public read company_tags" ON public.company_tags;
CREATE POLICY "Users can view company tags of accessible companies" 
ON public.company_tags FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id));

-- Update tax_planning policies to be consistent
DROP POLICY IF EXISTS "Users can view tax planning for their companies" ON public.tax_planning;
CREATE POLICY "Users can view tax planning for their companies" 
ON public.tax_planning FOR SELECT 
USING (user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can insert tax planning for their companies" ON public.tax_planning;
CREATE POLICY "Users can insert tax planning for their companies" 
ON public.tax_planning FOR INSERT 
WITH CHECK (user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can update tax planning for their companies" ON public.tax_planning;
CREATE POLICY "Users can update tax planning for their companies" 
ON public.tax_planning FOR UPDATE 
USING (user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can delete tax planning for their companies" ON public.tax_planning;
CREATE POLICY "Users can delete tax planning for their companies" 
ON public.tax_planning FOR DELETE 
USING (user_has_company_access(auth.uid(), company_id));
