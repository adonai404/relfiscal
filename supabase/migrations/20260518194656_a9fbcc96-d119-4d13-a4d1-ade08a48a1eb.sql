-- Add api_key column to companies if it doesn't exist
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS api_key UUID DEFAULT gen_random_uuid();

-- Create an index for faster lookups during API calls
CREATE INDEX IF NOT EXISTS idx_companies_api_key ON public.companies(api_key);

-- Ensure users can see the API key of companies they have access to
-- (Existing RLS on companies table should already cover this, but being explicit is better for sensitive fields if we had column-level security)
