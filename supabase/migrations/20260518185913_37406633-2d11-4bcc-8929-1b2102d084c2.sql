-- Table for tracking XML uploads
CREATE TABLE public.tax_planning_xml_uploads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    xml_type TEXT NOT NULL, -- 'NF_EMITIDA', 'NF_RECEBIDA', 'NFC_EMITIDA'
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for extracted products from XMLs
CREATE TABLE public.tax_planning_products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES public.tax_planning_xml_uploads(id) ON DELETE CASCADE,
    xml_type TEXT NOT NULL,
    product_code TEXT,
    product_name TEXT NOT NULL,
    ncm TEXT,
    cfop TEXT,
    ucom TEXT,
    qcom NUMERIC,
    vuncom NUMERIC,
    vprod NUMERIC,
    vicms NUMERIC DEFAULT 0,
    vipi NUMERIC DEFAULT 0,
    vpis NUMERIC DEFAULT 0,
    vcofins NUMERIC DEFAULT 0,
    emission_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tax_planning_xml_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_planning_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Simplified using company_users or existing logic)
CREATE POLICY "Users can view uploads for their companies" ON public.tax_planning_xml_uploads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.company_users 
            WHERE company_id = tax_planning_xml_uploads.company_id 
            AND user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can insert uploads for their companies" ON public.tax_planning_xml_uploads
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_users 
            WHERE company_id = tax_planning_xml_uploads.company_id 
            AND user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can view products for their companies" ON public.tax_planning_products
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.company_users 
            WHERE company_id = tax_planning_products.company_id 
            AND user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
