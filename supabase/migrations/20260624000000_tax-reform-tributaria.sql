-- Reforma Tributária: categorias, meses, mudanças, checklist, tarefas e anexos.
-- RLS: todas as tabelas são visíveis para qualquer usuário autenticado do escritório.

CREATE TYPE tax_reform_urgency AS ENUM ('critical', 'important', 'informational');
CREATE TYPE tax_reform_task_status AS ENUM ('pending', 'completed', 'overdue', 'paused', 'waiting');

-- Categorias
CREATE TABLE public.tax_reform_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tax_reform_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_reform_categories TO authenticated;
CREATE POLICY "All authenticated users manage categories"
  ON public.tax_reform_categories FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Meses
CREATE TABLE public.tax_reform_months (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL,
  year       int  NOT NULL,
  month      int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  position   int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);
ALTER TABLE public.tax_reform_months ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_reform_months TO authenticated;
CREATE POLICY "All authenticated users manage months"
  ON public.tax_reform_months FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Mudanças
CREATE TABLE public.tax_reform_changes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id    uuid NOT NULL REFERENCES public.tax_reform_months(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.tax_reform_categories(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  exact_date  date NOT NULL,
  urgency     tax_reform_urgency NOT NULL DEFAULT 'informational',
  notes       text,
  position    int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_reform_changes_month ON public.tax_reform_changes(month_id);
ALTER TABLE public.tax_reform_changes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_reform_changes TO authenticated;
CREATE POLICY "All authenticated users manage changes"
  ON public.tax_reform_changes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE TRIGGER trg_tax_reform_changes_updated_at
  BEFORE UPDATE ON public.tax_reform_changes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checklist
CREATE TABLE public.tax_reform_checklist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id  uuid NOT NULL REFERENCES public.tax_reform_changes(id) ON DELETE CASCADE,
  text       text NOT NULL,
  checked    boolean NOT NULL DEFAULT false,
  position   int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_reform_checklist_change ON public.tax_reform_checklist(change_id);
ALTER TABLE public.tax_reform_checklist ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_reform_checklist TO authenticated;
CREATE POLICY "All authenticated users manage checklist"
  ON public.tax_reform_checklist FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Tarefas
CREATE TABLE public.tax_reform_tasks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id  uuid NOT NULL REFERENCES public.tax_reform_changes(id) ON DELETE CASCADE,
  title      text NOT NULL,
  status     tax_reform_task_status NOT NULL DEFAULT 'pending',
  position   int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_reform_tasks_change ON public.tax_reform_tasks(change_id);
ALTER TABLE public.tax_reform_tasks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_reform_tasks TO authenticated;
CREATE POLICY "All authenticated users manage tasks"
  ON public.tax_reform_tasks FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE TRIGGER trg_tax_reform_tasks_updated_at
  BEFORE UPDATE ON public.tax_reform_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Anexos
CREATE TABLE public.tax_reform_attachments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id  uuid NOT NULL REFERENCES public.tax_reform_changes(id) ON DELETE CASCADE,
  file_name  text NOT NULL,
  file_path  text NOT NULL,
  file_size  bigint,
  file_mime  text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_reform_attachments_change ON public.tax_reform_attachments(change_id);
ALTER TABLE public.tax_reform_attachments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_reform_attachments TO authenticated;
CREATE POLICY "All authenticated users manage attachments"
  ON public.tax_reform_attachments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tax-reform-files', 'tax-reform-files', false, 52428800,
  ARRAY['application/pdf','image/png','image/jpeg','image/gif','image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword','application/vnd.ms-excel','text/plain']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload tax reform files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tax-reform-files');
CREATE POLICY "Authenticated users can read tax reform files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tax-reform-files');
CREATE POLICY "Authenticated users can delete tax reform files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tax-reform-files');
