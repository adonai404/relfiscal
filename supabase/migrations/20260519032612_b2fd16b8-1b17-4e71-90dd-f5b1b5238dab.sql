-- Drop existing policy if it exists (using a slightly different name to avoid conflicts)
DROP POLICY IF EXISTS "Customers can view their assigned companies" ON public.companies;

-- Create or update the policy to ensure customers can see their companies
CREATE POLICY "Users can view companies via customer link"
ON public.companies
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN customer_companies cc ON cc.customer_id = p.customer_id
        WHERE p.id = auth.uid() AND cc.company_id = public.companies.id
    )
);