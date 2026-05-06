-- Create company_users table to link users to companies
CREATE TABLE public.company_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, user_id)
);

-- Enable RLS
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- Policies for company_users
CREATE POLICY "Super admins can manage company_users"
ON public.company_users
FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own links"
ON public.company_users
FOR SELECT
USING (user_id = auth.uid());

-- Helper function to check if user has access to a company
CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND (created_by = _user_id OR is_super_admin(_user_id))
  ) OR EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = _company_id AND user_id = _user_id
  );
$$;

-- Update RLS policies for companies to include company_users access
DROP POLICY "Public read companies" ON public.companies;
CREATE POLICY "Users can view accessible companies"
ON public.companies
FOR SELECT
USING (user_has_company_access(auth.uid(), id));

DROP POLICY "Owner or super_admin update companies" ON public.companies;
CREATE POLICY "Users can update accessible companies"
ON public.companies
FOR UPDATE
USING (user_has_company_access(auth.uid(), id));

-- Also update policies for related tables to use user_has_company_access
-- custom_columns
DROP POLICY IF EXISTS "Public read custom columns" ON public.custom_columns;
CREATE POLICY "Users can view custom columns of accessible companies"
ON public.custom_columns FOR SELECT USING (user_has_company_access(auth.uid(), company_id));

-- fiscal_movement
DROP POLICY IF EXISTS "Public read movements" ON public.fiscal_movement;
CREATE POLICY "Users can view movements of accessible companies"
ON public.fiscal_movement FOR SELECT USING (user_has_company_access(auth.uid(), company_id));

-- fiscal_config
DROP POLICY IF EXISTS "Public read fiscal config" ON public.fiscal_config;
CREATE POLICY "Users can view fiscal config of accessible companies"
ON public.fiscal_config FOR SELECT USING (user_has_company_access(auth.uid(), company_id));
