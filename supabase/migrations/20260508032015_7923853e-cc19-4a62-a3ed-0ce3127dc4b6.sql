CREATE TABLE public.tax_planning (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tax_regime TEXT NOT NULL CHECK (tax_regime IN ('SIMPLES NACIONAL', 'LUCRO REAL', 'LUCRO PRESUMIDO')),
  status TEXT NOT NULL DEFAULT 'draft',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tax_planning ENABLE ROW LEVEL SECURITY;

-- Create policies based on user_roles and company_users
CREATE POLICY "Users can view tax planning for their companies"
ON public.tax_planning
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'super_admin'
  ) OR EXISTS (
    SELECT 1 FROM company_users 
    WHERE company_users.user_id = auth.uid() 
    AND company_users.company_id = tax_planning.company_id
  )
);

CREATE POLICY "Users can insert tax planning for their companies"
ON public.tax_planning
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'super_admin'
  ) OR EXISTS (
    SELECT 1 FROM company_users 
    WHERE company_users.user_id = auth.uid() 
    AND company_users.company_id = tax_planning.company_id
  )
);

CREATE POLICY "Users can update tax planning for their companies"
ON public.tax_planning
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'super_admin'
  ) OR EXISTS (
    SELECT 1 FROM company_users 
    WHERE company_users.user_id = auth.uid() 
    AND company_users.company_id = tax_planning.company_id
  )
);

CREATE POLICY "Users can delete tax planning for their companies"
ON public.tax_planning
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'super_admin'
  ) OR EXISTS (
    SELECT 1 FROM company_users 
    WHERE company_users.user_id = auth.uid() 
    AND company_users.company_id = tax_planning.company_id
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tax_planning_updated_at
BEFORE UPDATE ON public.tax_planning
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();