-- Add missing INSERT policy for tax_planning_products
CREATE POLICY "Users can insert products for their companies"
ON public.tax_planning_products
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_id = tax_planning_products.company_id 
    AND user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Re-verify or ensure tax_planning_xml_uploads insert policy is solid
-- (The existing one seems correct but we ensure it covers all cases)
DROP POLICY IF EXISTS "Users can insert uploads for their companies" ON public.tax_planning_xml_uploads;
CREATE POLICY "Users can insert uploads for their companies"
ON public.tax_planning_xml_uploads
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE company_id = tax_planning_xml_uploads.company_id 
    AND user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);