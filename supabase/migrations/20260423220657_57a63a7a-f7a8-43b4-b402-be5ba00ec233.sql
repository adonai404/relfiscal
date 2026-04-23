-- Add `format` column to custom_columns to control display: 'currency' (R$) or 'percent' (%).
ALTER TABLE public.custom_columns
ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'currency';

-- Optional check to keep values constrained
ALTER TABLE public.custom_columns
DROP CONSTRAINT IF EXISTS custom_columns_format_check;

ALTER TABLE public.custom_columns
ADD CONSTRAINT custom_columns_format_check
CHECK (format IN ('currency', 'percent'));