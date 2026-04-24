-- Add a configurable list of columns that count as "taxes" per company.
-- Default mirrors the previous hardcoded list so behaviour stays identical.
ALTER TABLE public.fiscal_config
  ADD COLUMN IF NOT EXISTS tax_columns jsonb NOT NULL
  DEFAULT '["icms","difal","pis","cofins","irpj","csll","impostos_federais","simples_nacional"]'::jsonb;