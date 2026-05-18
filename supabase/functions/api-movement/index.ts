import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
     const supabaseClient = createClient(
       Deno.env.get('SUPABASE_URL') ?? '',
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
     )

    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing x-api-key header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify API Key
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('id, nome_fantasia')
      .eq('api_key', apiKey)
      .single()

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: 'Invalid API Key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const contentType = req.headers.get('content-type') || '';
    let body: any;
    let xmlContent: string | null = null;

    if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
      xmlContent = await req.text();
    } else {
      body = await req.json();
    }

    let competencia: string | undefined;
    let entrada: number | undefined;
    let saida: number | undefined;
    let nfe_saida: number | undefined;
    let nfe_entrada: number | undefined;
    let cupom: number | undefined;
    let servico: number | undefined;

    if (xmlContent) {
      // Basic XML parsing for NFe/NFCe (NF-e is typically emitted by the company or received)
      // We look for <dhEmi> or <dEmi> for date, and <vNF> for value
      const emitMatch = xmlContent.match(/<emit>[\s\S]*?<CNPJ>(.*?)<\/CNPJ>/);
      const destMatch = xmlContent.match(/<dest>[\s\S]*?<CNPJ>(.*?)<\/CNPJ>/);
      const dateMatch = xmlContent.match(/<(?:dhEmi|dEmi)>(.*?)<\/(?:dhEmi|dEmi)>/);
      const valueMatch = xmlContent.match(/<vNF>(.*?)<\/vNF>/);
      const typeMatch = xmlContent.match(/<mod>(.*?)<\/mod>/); // 55 = NFe, 65 = NFCe

      if (!dateMatch || !valueMatch) {
        return new Response(JSON.stringify({ error: 'Could not extract date or value from XML' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const dateStr = dateMatch[1].substring(0, 10); // YYYY-MM-DD
      competencia = dateStr;
      const value = parseFloat(valueMatch[1]);
      const mod = typeMatch ? typeMatch[1] : '';

      // Get company CNPJ to determine if it's entry or exit
      const { data: compData } = await supabaseClient
        .from('companies')
        .select('cnpj')
        .eq('id', company.id)
        .single();
      
      const companyCnpj = compData?.cnpj?.replace(/\D/g, '');
      const emitCnpj = emitMatch ? emitMatch[1].replace(/\D/g, '') : '';
      
      if (emitCnpj === companyCnpj) {
        // Exit (Saída)
        if (mod === '65') {
          cupom = value;
        } else {
          nfe_saida = value;
        }
      } else {
        // Entry (Entrada)
        nfe_entrada = value;
      }
    } else {
      ({ 
        competencia, 
        entrada, 
        saida, 
        nfe_saida, 
        nfe_entrada, 
        cupom, 
        servico 
      } = body);
    }

    if (!competencia) {
      return new Response(JSON.stringify({ error: 'Missing competencia' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prepare values
    // If saida/entrada are not provided, we calculate them from the details
    const finalNfeSaida = nfe_saida !== undefined ? Number(nfe_saida) : undefined;
    const finalNfeEntrada = nfe_entrada !== undefined ? Number(nfe_entrada) : undefined;
    const finalCupom = cupom !== undefined ? Number(cupom) : undefined;
    const finalServico = servico !== undefined ? Number(servico) : undefined;

    const calculatedSaida = (Number(finalNfeSaida || 0) + Number(finalCupom || 0) + Number(finalServico || 0));
    const finalSaida = saida !== undefined ? Number(saida) : (calculatedSaida || 0);
    
    const finalEntrada = entrada !== undefined ? Number(entrada) : (Number(finalNfeEntrada || 0));

    // Get existing movement to accumulate values if it's an XML upload
    // (Since one competencia can have multiple XMLs)
    const { data: existing } = await supabaseClient
      .from('fiscal_movement')
      .select('*')
      .eq('company_id', company.id)
      .eq('competencia', competencia)
      .maybeSingle();

    const payload: any = {
      company_id: company.id,
      competencia,
      updated_at: new Date().toISOString(),
    };

    if (xmlContent) {
      // Increment existing values for XML
      payload.nfe_saida = (existing?.nfe_saida || 0) + (nfe_saida || 0);
      payload.nfe_entrada = (existing?.nfe_entrada || 0) + (nfe_entrada || 0);
      payload.cupom = (existing?.cupom || 0) + (cupom || 0);
      payload.servico = (existing?.servico || 0) + (servico || 0);
      
      payload.saida = (existing?.saida || 0) + (nfe_saida || 0) + (cupom || 0) + (servico || 0);
      payload.entrada = (existing?.entrada || 0) + (nfe_entrada || 0);
    } else {
      // JSON overrides or sets directly
      payload.entrada = finalEntrada;
      payload.saida = finalSaida;
      if (finalNfeSaida !== undefined) payload.nfe_saida = finalNfeSaida;
      if (finalNfeEntrada !== undefined) payload.nfe_entrada = finalNfeEntrada;
      if (finalCupom !== undefined) payload.cupom = finalCupom;
      if (finalServico !== undefined) payload.servico = finalServico;
    }

    // Insert or Update movement
    const { data, error } = await supabaseClient
      .from('fiscal_movement')
      .upsert(payload, { onConflict: 'company_id, competencia' })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ message: 'Success', data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
