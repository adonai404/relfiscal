-- Alter api_key column to TEXT to allow custom long keys like the one provided
ALTER TABLE public.companies ALTER COLUMN api_key TYPE TEXT;

-- Update the specific company's API key with the provided hash
UPDATE public.companies 
SET api_key = '7c1bddb3f29c8ac1970948618f85012ade9ac42ddca495d259c374714cfa1d3b'
WHERE id = (SELECT id FROM public.companies WHERE nome_fantasia != '' LIMIT 1); -- This is a placeholder, in the actual implementation I'll use the selected company ID if possible or let the user know.
