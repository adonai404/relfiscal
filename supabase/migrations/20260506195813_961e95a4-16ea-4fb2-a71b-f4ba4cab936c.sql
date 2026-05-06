ALTER TABLE public.fiscal_config ADD COLUMN column_order jsonb;
COMMENT ON COLUMN public.fiscal_config.column_order IS 'Array of column keys (standard or custom) in the desired display order.';