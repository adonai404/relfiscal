-- Allow company_documentation rows without a company (company_id IS NULL)

DROP POLICY IF EXISTS "Owner insert documentation" ON public.company_documentation;
DROP POLICY IF EXISTS "Owner update documentation" ON public.company_documentation;
DROP POLICY IF EXISTS "Owner delete documentation" ON public.company_documentation;
DROP POLICY IF EXISTS "Read company documentation" ON public.company_documentation;

CREATE POLICY "Read company documentation"
ON public.company_documentation FOR SELECT
USING (
  company_id IS NULL
  OR public.user_can_read_company(auth.uid(), company_id)
);

CREATE POLICY "Owner insert documentation"
ON public.company_documentation FOR INSERT TO authenticated
WITH CHECK (
  company_id IS NULL
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE POLICY "Owner update documentation"
ON public.company_documentation FOR UPDATE
USING (
  company_id IS NULL
  OR public.user_has_company_access(auth.uid(), company_id)
);

CREATE POLICY "Owner delete documentation"
ON public.company_documentation FOR DELETE
USING (
  company_id IS NULL
  OR public.user_has_company_access(auth.uid(), company_id)
);
