
CREATE TABLE public.company_documentation (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_documentation_company ON public.company_documentation(company_id, position);

ALTER TABLE public.company_documentation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view documentation of accessible companies"
ON public.company_documentation FOR SELECT
USING (public.user_can_read_company(auth.uid(), company_id));

CREATE POLICY "Owner insert documentation"
ON public.company_documentation FOR INSERT TO authenticated
WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Owner update documentation"
ON public.company_documentation FOR UPDATE
USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Owner delete documentation"
ON public.company_documentation FOR DELETE
USING (public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_company_documentation_updated_at
BEFORE UPDATE ON public.company_documentation
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
