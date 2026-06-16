
ALTER TABLE public.user_tools
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'public'));

DROP POLICY IF EXISTS "Users manage their own tools" ON public.user_tools;

CREATE POLICY "View own or public tools"
ON public.user_tools FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR visibility = 'public');

CREATE POLICY "Insert own tools"
ON public.user_tools FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own tools"
ON public.user_tools FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Delete own tools"
ON public.user_tools FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
