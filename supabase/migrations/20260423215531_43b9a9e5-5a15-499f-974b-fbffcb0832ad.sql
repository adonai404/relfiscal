CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_tags_name_unique ON public.tags (lower(name));

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tags"
  ON public.tags FOR SELECT USING (true);

CREATE POLICY "Active users insert tags"
  ON public.tags FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_is_active(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Owner or super_admin update tags"
  ON public.tags FOR UPDATE
  USING (created_by = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Owner or super_admin delete tags"
  ON public.tags FOR DELETE
  USING (created_by = auth.uid() OR is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_tags_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.update_tags_updated_at();

-- Many-to-many association
CREATE TABLE public.company_tags (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, tag_id)
);

CREATE INDEX idx_company_tags_company ON public.company_tags(company_id);
CREATE INDEX idx_company_tags_tag ON public.company_tags(tag_id);

ALTER TABLE public.company_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read company_tags"
  ON public.company_tags FOR SELECT USING (true);

CREATE POLICY "Owner insert company_tags"
  ON public.company_tags FOR INSERT
  WITH CHECK (user_has_company_access(auth.uid(), company_id) AND user_is_active(auth.uid()));

CREATE POLICY "Owner delete company_tags"
  ON public.company_tags FOR DELETE
  USING (user_has_company_access(auth.uid(), company_id));