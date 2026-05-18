-- Add new columns to fiscal_movement
ALTER TABLE public.fiscal_movement 
ADD COLUMN IF NOT EXISTS nfe_saida NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS nfe_entrada NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cupom NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS servico NUMERIC DEFAULT 0;

-- Add new columns to fiscal_config
ALTER TABLE public.fiscal_config
ADD COLUMN IF NOT EXISTS show_nfe_saida_column BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_nfe_entrada_column BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_cupom_column BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_servico_column BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS label_nfe_saida TEXT DEFAULT 'NF-e Saída',
ADD COLUMN IF NOT EXISTS label_nfe_entrada TEXT DEFAULT 'NF-e Entrada',
ADD COLUMN IF NOT EXISTS label_cupom TEXT DEFAULT 'Cupom',
ADD COLUMN IF NOT EXISTS label_servico TEXT DEFAULT 'Serviço';
