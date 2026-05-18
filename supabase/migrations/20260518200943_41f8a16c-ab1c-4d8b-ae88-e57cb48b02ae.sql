-- Add planning_id to tax_planning_xml_uploads
ALTER TABLE public.tax_planning_xml_uploads 
ADD COLUMN planning_id UUID REFERENCES public.tax_planning(id) ON DELETE CASCADE;

-- Add planning_id to tax_planning_products
ALTER TABLE public.tax_planning_products 
ADD COLUMN planning_id UUID REFERENCES public.tax_planning(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_tax_planning_xml_uploads_planning_id ON public.tax_planning_xml_uploads(planning_id);
CREATE INDEX idx_tax_planning_products_planning_id ON public.tax_planning_products(planning_id);

-- Update RLS policies to include planning_id checks if needed (usually company_id is enough but planning_id adds granularity)
-- No changes needed to existing policies if they already cover the user's access via company_users or roles.
