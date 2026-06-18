
CREATE OR REPLACE FUNCTION public.duplicate_company(_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  src public.companies%ROWTYPE;
  new_id uuid;
  new_cnpj text;
  suffix int;
  col record;
  mov record;
  new_mov_id uuid;
  col_id_map jsonb := '{}'::jsonb;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO src FROM public.companies WHERE id = _company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa de origem não encontrada';
  END IF;

  IF NOT public.user_can_read_company(current_user_id, _company_id) THEN
    RAISE EXCEPTION 'Sem permissão para duplicar esta empresa';
  END IF;

  suffix := floor(random() * 9000 + 1000)::int;
  new_cnpj := left(regexp_replace(src.cnpj, '\D', '', 'g'), 10) || suffix::text;

  INSERT INTO public.companies (
    cnpj, razao_social, nome_fantasia, uf, regime, status, folder_id, created_by
  ) VALUES (
    new_cnpj,
    coalesce(src.razao_social, 'A definir') || ' (cópia)',
    coalesce(src.nome_fantasia, 'Empresa') || ' (cópia)',
    src.uf,
    src.regime,
    coalesce(src.status, 'ativa'),
    src.folder_id,
    current_user_id
  ) RETURNING id INTO new_id;

  -- fiscal_config: trigger já criou linha vazia → atualiza com dados da origem
  UPDATE public.fiscal_config dst SET
    aliquota_icms = s.aliquota_icms,
    aliquota_pis = s.aliquota_pis,
    aliquota_cofins = s.aliquota_cofins,
    aliquota_irpj = s.aliquota_irpj,
    aliquota_csll = s.aliquota_csll,
    aliquota_iss = s.aliquota_iss,
    aliquota_simples = s.aliquota_simples,
    aliquota_difal = s.aliquota_difal,
    margem_lucro = s.margem_lucro,
    presuncao_irpj = s.presuncao_irpj,
    presuncao_csll = s.presuncao_csll,
    irpj_adicional_aliquota = s.irpj_adicional_aliquota,
    irpj_adicional_limite_mensal = s.irpj_adicional_limite_mensal,
    pis_aliquota = s.pis_aliquota,
    cofins_aliquota = s.cofins_aliquota,
    icms_aliquota = s.icms_aliquota,
    iss_aliquota = s.iss_aliquota,
    simples_anexo = s.simples_anexo,
    simples_faixa = s.simples_faixa,
    fator_r = s.fator_r,
    pro_labore = s.pro_labore,
    folha_simples = s.folha_simples,
    despesas_fixas = s.despesas_fixas,
    honorarios_fixos = s.honorarios_fixos,
    encargos_aliquota = s.encargos_aliquota,
    inss_patronal = s.inss_patronal,
    fgts_aliquota = s.fgts_aliquota,
    rat_aliquota = s.rat_aliquota,
    terceiros_aliquota = s.terceiros_aliquota,
    cprb_aliquota = s.cprb_aliquota,
    desconto_simples = s.desconto_simples,
    aliquota_efetiva_simples = s.aliquota_efetiva_simples,
    parcela_deducao_simples = s.parcela_deducao_simples,
    folha_anual = s.folha_anual,
    receita_bruta_12m = s.receita_bruta_12m,
    observacoes = s.observacoes
  FROM public.fiscal_config s
  WHERE s.company_id = _company_id AND dst.company_id = new_id;

  -- custom_columns
  FOR col IN SELECT * FROM public.custom_columns WHERE company_id = _company_id LOOP
    DECLARE new_col_id uuid;
    BEGIN
      INSERT INTO public.custom_columns (company_id, key, label, kind, formula, position, visible, decimals, format)
      VALUES (new_id, col.key, col.label, col.kind, col.formula, col.position, col.visible, col.decimals, col.format)
      RETURNING id INTO new_col_id;
      col_id_map := col_id_map || jsonb_build_object(col.id::text, new_col_id::text);
    END;
  END LOOP;

  -- fiscal_movement + custom_column_values
  FOR mov IN SELECT * FROM public.fiscal_movement WHERE company_id = _company_id LOOP
    INSERT INTO public.fiscal_movement (
      company_id, competencia, entrada, saida, icms, impostos_federais, simples_nacional,
      honorarios, folha, encargos_patronal, difal, pis, cofins, irpj, csll,
      nfe_saida, nfe_entrada, cupom, servico
    ) VALUES (
      new_id, mov.competencia, mov.entrada, mov.saida, mov.icms, mov.impostos_federais, mov.simples_nacional,
      mov.honorarios, mov.folha, mov.encargos_patronal, mov.difal, mov.pis, mov.cofins, mov.irpj, mov.csll,
      mov.nfe_saida, mov.nfe_entrada, mov.cupom, mov.servico
    ) RETURNING id INTO new_mov_id;

    INSERT INTO public.custom_column_values (movement_id, column_id, value)
    SELECT new_mov_id, (col_id_map->>(v.column_id::text))::uuid, v.value
    FROM public.custom_column_values v
    WHERE v.movement_id = mov.id
      AND col_id_map ? v.column_id::text;
  END LOOP;

  -- company_tags
  INSERT INTO public.company_tags (company_id, tag_id)
  SELECT new_id, tag_id FROM public.company_tags WHERE company_id = _company_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.duplicate_company(uuid) TO authenticated;
