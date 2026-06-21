import { createClient } from "npm:@supabase/supabase-js@2";
import { createAnthropic } from "npm:@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "npm:ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const { threadId, messages } = body as { threadId: string; messages: UIMessage[] };
    if (!threadId || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers: corsHeaders });
    }

    // Load thread (RLS ensures ownership)
    const { data: thread, error: tErr } = await supabase
      .from("ai_threads")
      .select("id, user_id, title, company_ids")
      .eq("id", threadId)
      .maybeSingle();
    if (tErr || !thread || thread.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Thread not found" }), { status: 404, headers: corsHeaders });
    }

    const companyIds: string[] = thread.company_ids ?? [];
    let contextBlock = "Nenhuma empresa selecionada para esta conversa.";
    let companiesInfo: { id: string; nome_fantasia: string; razao_social: string; cnpj: string }[] = [];

    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, nome_fantasia, razao_social, cnpj")
        .in("id", companyIds);
      companiesInfo = companies ?? [];

      const { data: rows } = await supabase
        .from("fiscal_movement")
        .select(
          "company_id, competencia, entrada, saida, icms, impostos_federais, simples_nacional, honorarios, folha, encargos_patronal, difal, pis, cofins, irpj, csll, nfe_saida, nfe_entrada, cupom, servico",
        )
        .in("company_id", companyIds)
        .order("competencia", { ascending: false });

      const all = rows ?? [];
      const byCompany = new Map<string, typeof all>();
      for (const r of all) {
        const arr = byCompany.get(r.company_id) ?? [];
        arr.push(r);
        byCompany.set(r.company_id, arr);
      }

      const sections: string[] = [];
      for (const c of companiesInfo) {
        const rs = byCompany.get(c.id) ?? [];
        const sectionRows =
          rs.length > 60
            ? rs.slice(0, 24) // most recent 24
            : rs;
        sections.push(
          `### Empresa: ${c.nome_fantasia || c.razao_social} (CNPJ ${c.cnpj}, id ${c.id})\n` +
            `Total de competências: ${rs.length}${rs.length > 60 ? " (mostrando as 24 mais recentes em detalhe + agregado geral)" : ""}\n` +
            "Movimentos:\n" +
            (sectionRows.length === 0
              ? "(sem dados)"
              : sectionRows
                  .map((r) => {
                    return [
                      `- competência ${r.competencia}:`,
                      `entrada=${fmtBRL(r.entrada)}`,
                      `saída=${fmtBRL(r.saida)}`,
                      `ICMS=${fmtBRL(r.icms)}`,
                      `impostos_federais=${fmtBRL(r.impostos_federais)}`,
                      `simples=${fmtBRL(r.simples_nacional)}`,
                      `PIS=${fmtBRL(r.pis)}`,
                      `COFINS=${fmtBRL(r.cofins)}`,
                      `IRPJ=${fmtBRL(r.irpj)}`,
                      `CSLL=${fmtBRL(r.csll)}`,
                      `DIFAL=${fmtBRL(r.difal)}`,
                      `honorarios=${fmtBRL(r.honorarios)}`,
                      `folha=${fmtBRL(r.folha)}`,
                      `encargos=${fmtBRL(r.encargos_patronal)}`,
                      `NFe_saida=${fmtBRL(r.nfe_saida ?? 0)}`,
                      `NFe_entrada=${fmtBRL(r.nfe_entrada ?? 0)}`,
                      `cupom=${fmtBRL(r.cupom ?? 0)}`,
                      `serviço=${fmtBRL(r.servico ?? 0)}`,
                    ].join(" ");
                  })
                  .join("\n")),
        );

        if (rs.length > 60) {
          const sum = (k: string) => rs.reduce((a, r: any) => a + Number(r[k] ?? 0), 0);
          sections.push(
            `Agregado total (${rs.length} competências) — entrada=${fmtBRL(sum("entrada"))}, saída=${fmtBRL(
              sum("saida"),
            )}, ICMS=${fmtBRL(sum("icms"))}, fed=${fmtBRL(sum("impostos_federais"))}, simples=${fmtBRL(
              sum("simples_nacional"),
            )}, PIS=${fmtBRL(sum("pis"))}, COFINS=${fmtBRL(sum("cofins"))}, IRPJ=${fmtBRL(
              sum("irpj"),
            )}, CSLL=${fmtBRL(sum("csll"))}.`,
          );
        }
      }
      contextBlock = sections.join("\n\n");
    }

    const system = [
      "Você é o Assistente Fiscal do Fiscal.aqui.",
      "Responda SOMENTE com base nos dados da aba Movimento fornecidos abaixo.",
      "Se a pergunta não puder ser respondida com esses dados, diga claramente que não há informação suficiente e sugira o que selecionar.",
      "Use português do Brasil. Valores monetários em BRL. Competência no formato YYYY-MM.",
      "Seja conciso, use markdown e tabelas quando ajudar.",
      "",
      "=== DADOS DE MOVIMENTO (escopo desta conversa) ===",
      contextBlock,
      "=== FIM DOS DADOS ===",
    ].join("\n");

    const anthropic = createAnthropic({ apiKey: anthropicApiKey });

    const result = streamText({
      model: anthropic("claude-sonnet-4-5-20250929"),
      system,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse({
      headers: corsHeaders,
      originalMessages: messages,
      onFinish: async ({ messages: finalMessages }) => {
        try {
          // Persist the latest user message + the new assistant message
          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          const newAssistant = finalMessages[finalMessages.length - 1];
          const rows: any[] = [];
          if (lastUser) {
            rows.push({ thread_id: threadId, role: "user", parts: lastUser.parts ?? [] });
          }
          if (newAssistant && newAssistant.role === "assistant") {
            rows.push({ thread_id: threadId, role: "assistant", parts: newAssistant.parts ?? [] });
          }
          if (rows.length) {
            await supabase.from("ai_messages").insert(rows);
            await supabase
              .from("ai_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
          }
        } catch (e) {
          console.error("Persist error", e);
        }
      },
    });
  } catch (err) {
    console.error("assistant-chat error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});