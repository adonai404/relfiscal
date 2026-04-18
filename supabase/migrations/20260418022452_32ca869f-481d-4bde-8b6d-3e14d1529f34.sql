ALTER TABLE public.fiscal_movement
ADD CONSTRAINT fiscal_movement_company_competencia_unique UNIQUE (company_id, competencia);