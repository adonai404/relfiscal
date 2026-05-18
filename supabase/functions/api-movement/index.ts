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
      Deno.env.get('VITE_SUPABASE_URL') ?? '',
      Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

    const body = await req.json();
    const { 
      competencia, 
      entrada, 
      saida, 
      nfe_saida, 
      nfe_entrada, 
      cupom, 
      servico 
    } = body;

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

    const payload: any = {
      company_id: company.id,
      competencia,
      entrada: finalEntrada,
      saida: finalSaida,
      updated_at: new Date().toISOString(),
    };

    if (finalNfeSaida !== undefined) payload.nfe_saida = finalNfeSaida;
    if (finalNfeEntrada !== undefined) payload.nfe_entrada = finalNfeEntrada;
    if (finalCupom !== undefined) payload.cupom = finalCupom;
    if (finalServico !== undefined) payload.servico = finalServico;

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
