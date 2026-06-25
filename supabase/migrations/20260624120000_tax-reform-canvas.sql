-- Canvas de fluxo da Reforma Tributária: nós e arestas.
-- RLS: visível para qualquer usuário autenticado do escritório.

CREATE TABLE public.tax_reform_canvas_nodes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id    text NOT NULL UNIQUE,
  title      text NOT NULL DEFAULT 'Novo Card',
  description text,
  notes      text,
  link       text,
  color      text NOT NULL DEFAULT '#ffffff',
  position_x float NOT NULL DEFAULT 0,
  position_y float NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tax_reform_canvas_nodes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_reform_canvas_nodes TO authenticated;
CREATE POLICY "canvas nodes all auth" ON public.tax_reform_canvas_nodes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_canvas_nodes_updated_at
  BEFORE UPDATE ON public.tax_reform_canvas_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tax_reform_canvas_edges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_id        text NOT NULL UNIQUE,
  source_node_id text NOT NULL,
  target_node_id text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tax_reform_canvas_edges ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_reform_canvas_edges TO authenticated;
CREATE POLICY "canvas edges all auth" ON public.tax_reform_canvas_edges
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
