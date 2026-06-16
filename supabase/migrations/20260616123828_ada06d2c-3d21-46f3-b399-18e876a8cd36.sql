
CREATE TABLE public.user_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL,
  icon text NOT NULL DEFAULT 'Wrench',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tools TO authenticated;
GRANT ALL ON public.user_tools TO service_role;

ALTER TABLE public.user_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tools"
ON public.user_tools FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_tools_set_updated_at
BEFORE UPDATE ON public.user_tools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
