-- =====================================================
-- Custom columns (per-company user-defined columns)
-- =====================================================

CREATE TABLE public.custom_columns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'formula')),
  formula jsonb NOT NULL DEFAULT '{"tokens": []}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  decimals integer NOT NULL DEFAULT 2,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id, key)
);

CREATE INDEX idx_custom_columns_company ON public.custom_columns(company_id);

ALTER TABLE public.custom_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read custom_columns"
  ON public.custom_columns
  FOR SELECT
  USING (true);

CREATE POLICY "Owner insert custom_columns"
  ON public.custom_columns
  FOR INSERT
  WITH CHECK (user_has_company_access(auth.uid(), company_id) AND user_is_active(auth.uid()));

CREATE POLICY "Owner update custom_columns"
  ON public.custom_columns
  FOR UPDATE
  USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Owner delete custom_columns"
  ON public.custom_columns
  FOR DELETE
  USING (user_has_company_access(auth.uid(), company_id));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_custom_columns_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_custom_columns_updated_at
  BEFORE UPDATE ON public.custom_columns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_custom_columns_updated_at();

-- =====================================================
-- Custom column values (per movement row, per custom column)
-- =====================================================

CREATE TABLE public.custom_column_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movement_id uuid NOT NULL REFERENCES public.fiscal_movement(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.custom_columns(id) ON DELETE CASCADE,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (movement_id, column_id)
);

CREATE INDEX idx_ccv_movement ON public.custom_column_values(movement_id);
CREATE INDEX idx_ccv_column ON public.custom_column_values(column_id);

ALTER TABLE public.custom_column_values ENABLE ROW LEVEL SECURITY;

-- Helper: derive company_id via the movement
CREATE POLICY "Public read custom_column_values"
  ON public.custom_column_values
  FOR SELECT
  USING (true);

CREATE POLICY "Owner insert custom_column_values"
  ON public.custom_column_values
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fiscal_movement m
      WHERE m.id = movement_id
        AND user_has_company_access(auth.uid(), m.company_id)
        AND user_is_active(auth.uid())
    )
  );

CREATE POLICY "Owner update custom_column_values"
  ON public.custom_column_values
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.fiscal_movement m
      WHERE m.id = movement_id
        AND user_has_company_access(auth.uid(), m.company_id)
    )
  );

CREATE POLICY "Owner delete custom_column_values"
  ON public.custom_column_values
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.fiscal_movement m
      WHERE m.id = movement_id
        AND user_has_company_access(auth.uid(), m.company_id)
    )
  );

CREATE TRIGGER trg_ccv_updated_at
  BEFORE UPDATE ON public.custom_column_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_custom_columns_updated_at();