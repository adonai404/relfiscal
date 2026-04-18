-- COMPANIES: substituir políticas restritas a admin por políticas baseadas em vínculo
DROP POLICY IF EXISTS "Public read companies" ON public.companies;
DROP POLICY IF EXISTS "Admins insert companies" ON public.companies;
DROP POLICY IF EXISTS "Admins update companies" ON public.companies;
DROP POLICY IF EXISTS "Admins delete companies" ON public.companies;

-- Leitura pública mantida apenas via slug (página /p/:slug usa anon). Permitimos leitura pública para suportar isso.
CREATE POLICY "Public can read companies"
  ON public.companies FOR SELECT
  USING (true);

CREATE POLICY "Authenticated approved users can insert companies"
  ON public.companies FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.approved = true)
    AND created_by = auth.uid()
  );

CREATE POLICY "Members or admin update companies"
  ON public.companies FOR UPDATE
  USING (public.user_has_company_access(auth.uid(), id));

CREATE POLICY "Members or admin delete companies"
  ON public.companies FOR DELETE
  USING (public.user_has_company_access(auth.uid(), id));

-- USER_COMPANIES: permitir que o trigger link_creator_to_company funcione e que o usuário insira o próprio vínculo se necessário
DROP POLICY IF EXISTS "Users insert own company link" ON public.user_companies;
CREATE POLICY "Users insert own company link"
  ON public.user_companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);