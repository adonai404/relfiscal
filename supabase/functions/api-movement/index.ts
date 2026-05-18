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

    const body = await req.json()
    const { competencia, entrada, saida } = body

    if (!competencia) {
      return new Response(JSON.stringify({ error: 'Missing competencia' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Insert or Update movement
    const { data, error } = await supabaseClient
      .from('fiscal_movement')
      .upsert({
        company_id: company.id,
        competencia,
        entrada: entrada || 0,
        saida: saida || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id, competencia' })
      .select()
      .single()

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
