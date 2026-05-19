-- Create customers table
CREATE TABLE public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to link customers to companies
CREATE TABLE public.customer_companies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(customer_id, company_id)
);

-- Add customer_id to profiles to identify which customer a user belongs to
ALTER TABLE public.profiles ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_companies ENABLE ROW LEVEL SECURITY;

-- Policies for customers table
CREATE POLICY "Super admins can manage customers"
ON public.customers
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY "Customers can view their own record"
ON public.customers
FOR SELECT
USING (
    id IN (
        SELECT customer_id FROM profiles WHERE id = auth.uid()
    )
);

-- Policies for customer_companies table
CREATE POLICY "Super admins can manage customer_companies"
ON public.customer_companies
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY "Customers can view their assigned companies links"
ON public.customer_companies
FOR SELECT
USING (
    customer_id IN (
        SELECT customer_id FROM profiles WHERE id = auth.uid()
    )
);

-- Update company policies to allow access via customer relationship
CREATE POLICY "Customers can view their assigned companies"
ON public.companies
FOR SELECT
USING (
    id IN (
        SELECT company_id FROM customer_companies
        WHERE customer_id IN (
            SELECT customer_id FROM profiles WHERE id = auth.uid()
        )
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();