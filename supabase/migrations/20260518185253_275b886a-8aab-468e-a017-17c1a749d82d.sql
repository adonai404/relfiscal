-- Create tax_planning_groups table
CREATE TABLE public.tax_planning_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tax_planning_groups ENABLE ROW LEVEL SECURITY;

-- Add group_id to tax_planning
ALTER TABLE public.tax_planning 
ADD COLUMN group_id UUID REFERENCES public.tax_planning_groups(id) ON DELETE SET NULL;

-- Policies for tax_planning_groups
CREATE POLICY "Users can view their own groups" 
ON public.tax_planning_groups 
FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own groups" 
ON public.tax_planning_groups 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own groups" 
ON public.tax_planning_groups 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own groups" 
ON public.tax_planning_groups 
FOR DELETE 
USING (auth.uid() = created_by);

-- Trigger for updated_at
CREATE TRIGGER update_tax_planning_groups_updated_at
BEFORE UPDATE ON public.tax_planning_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
