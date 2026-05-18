-- Update the check constraint for tax_regime to allow the new XML-based planning type
ALTER TABLE public.tax_planning 
DROP CONSTRAINT IF EXISTS tax_planning_tax_regime_check;

ALTER TABLE public.tax_planning 
ADD CONSTRAINT tax_planning_tax_regime_check 
CHECK (tax_regime IN ('SIMPLES NACIONAL', 'LUCRO REAL', 'LUCRO PRESUMIDO', 'POR PRODUTO (XML)'));
