
DO $$ BEGIN
  CREATE TYPE public.tax_regime AS ENUM ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS regime public.tax_regime NOT NULL DEFAULT 'simples_nacional';
