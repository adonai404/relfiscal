-- Fase 1 (migração desktop) — corrige o RLS da página pública /p/:slug.
--
-- Problemas corrigidos:
--   1) VAZAMENTO: fiscal_movement estava world-readable (policy
--      "Public read fiscal" USING(true)) -> qualquer anon baixava TODOS os
--      movimentos fiscais de todas as empresas.
--   2) PÁGINA QUEBRADA: companies/fiscal_config passaram a exigir login, então
--      /p/:slug mostrava "Empresa não encontrada" para visitantes sem sessão.
--
-- Solução: opt-in por empresa via companies.is_public (default false) + RPC
-- SECURITY DEFINER get_public_movement(slug) que expõe SOMENTE empresas marcadas
-- como públicas e SOMENTE as colunas necessárias (NUNCA api_key). Depois remove as
-- policies "Public read ... USING(true)" para fechar o acesso direto anônimo às
-- tabelas. O acesso autenticado normal é preservado pelas policies
-- "Users can view ... accessible companies" já existentes.

-- 1) Flag de opt-in (default privado).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- 2) RPC pública: whitelist de colunas; retorna dados só de empresas públicas.
CREATE OR REPLACE FUNCTION public.get_public_movement(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.companies%ROWTYPE;
  result jsonb;
BEGIN
  SELECT * INTO v_company
  FROM public.companies
  WHERE slug = p_slug AND is_public = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'company', jsonb_build_object(
      'id', v_company.id,
      'slug', v_company.slug,
      'cnpj', v_company.cnpj,
      'nome_fantasia', v_company.nome_fantasia,
      'razao_social', v_company.razao_social,
      'uf', v_company.uf
    ),
    'config', (
      SELECT to_jsonb(fc) FROM public.fiscal_config fc
      WHERE fc.company_id = v_company.id
      LIMIT 1
    ),
    'movements', COALESCE((
      SELECT jsonb_agg(to_jsonb(m) ORDER BY m.competencia ASC)
      FROM public.fiscal_movement m
      WHERE m.company_id = v_company.id
    ), '[]'::jsonb),
    'custom_columns', COALESCE((
      SELECT jsonb_agg(to_jsonb(cc) ORDER BY cc.position ASC, cc.created_at ASC)
      FROM public.custom_columns cc
      WHERE cc.company_id = v_company.id
    ), '[]'::jsonb),
    'custom_values', COALESCE((
      SELECT jsonb_agg(to_jsonb(ccv))
      FROM public.custom_column_values ccv
      JOIN public.fiscal_movement m ON m.id = ccv.movement_id
      WHERE m.company_id = v_company.id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_movement(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_movement(text) TO anon, authenticated;

-- 3) Fecha o acesso direto anônimo: remove as policies "Public read ... USING(true)".
--    (O acesso autenticado continua via "Users can view ... accessible companies".)
DROP POLICY IF EXISTS "Public read fiscal" ON public.fiscal_movement;
DROP POLICY IF EXISTS "Public read movements" ON public.fiscal_movement;
DROP POLICY IF EXISTS "Public read fiscal_movement" ON public.fiscal_movement;

DROP POLICY IF EXISTS "Public read fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "Public read fiscal config" ON public.fiscal_config;

DROP POLICY IF EXISTS "Public read custom_columns" ON public.custom_columns;
DROP POLICY IF EXISTS "Public read custom columns" ON public.custom_columns;

DROP POLICY IF EXISTS "Public read custom_column_values" ON public.custom_column_values;
DROP POLICY IF EXISTS "Public read custom column values" ON public.custom_column_values;
