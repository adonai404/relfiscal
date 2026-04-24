-- 1. Add company_status enum
CREATE TYPE public.company_status AS ENUM ('ativa', 'inativa', 'arquivada');

-- 2. Add status column to companies
ALTER TABLE public.companies
  ADD COLUMN status public.company_status NOT NULL DEFAULT 'ativa';

-- 3. Create company_folders table
CREATE TABLE public.company_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_by UUID,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read folders"
ON public.company_folders FOR SELECT
USING (true);

CREATE POLICY "Active users insert own folders"
ON public.company_folders FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid() AND user_is_active(auth.uid()));

CREATE POLICY "Owner or super_admin update folders"
ON public.company_folders FOR UPDATE
USING (created_by = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Owner or super_admin delete folders"
ON public.company_folders FOR DELETE
USING (created_by = auth.uid() OR is_super_admin(auth.uid()));

CREATE TRIGGER update_company_folders_updated_at
BEFORE UPDATE ON public.company_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add folder_id to companies
ALTER TABLE public.companies
  ADD COLUMN folder_id UUID REFERENCES public.company_folders(id) ON DELETE SET NULL;

CREATE INDEX idx_companies_folder_id ON public.companies(folder_id);
CREATE INDEX idx_companies_status ON public.companies(status);