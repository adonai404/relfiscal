-- Update policies for tax_planning_xml_uploads
DROP POLICY IF EXISTS "Users can view uploads for their companies" ON public.tax_planning_xml_uploads;
CREATE POLICY "Users can view uploads for their companies" 
ON public.tax_planning_xml_uploads 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.company_id = tax_planning_xml_uploads.company_id 
    AND company_users.user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS "Users can insert uploads for their companies" ON public.tax_planning_xml_uploads;
CREATE POLICY "Users can insert uploads for their companies" 
ON public.tax_planning_xml_uploads 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.company_id = tax_planning_xml_uploads.company_id 
    AND company_users.user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'super_admin')
  )
);

-- Update policies for tax_planning_products
DROP POLICY IF EXISTS "Users can view products for their companies" ON public.tax_planning_products;
CREATE POLICY "Users can view products for their companies" 
ON public.tax_planning_products 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.company_id = tax_planning_products.company_id 
    AND company_users.user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS "Users can insert products for their companies" ON public.tax_planning_products;
CREATE POLICY "Users can insert products for their companies" 
ON public.tax_planning_products 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_users.company_id = tax_planning_products.company_id 
    AND company_users.user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'super_admin')
  )
);
