import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdminData, error: adminErr } = await admin.rpc("is_super_admin", { _user_id: user.id });
    if (adminErr || !isAdminData) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "create") {
      const { name, email, password, company_ids } = body;
      if (!name || !email || !password) return json({ error: "Campos obrigatórios faltando" }, 400);
      if (String(password).length < 6) return json({ error: "Senha mínima 6 caracteres" }, 400);

      // 1. create auth user (auto-confirm)
      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: name, is_customer: true },
      });
      if (authErr || !created.user) return json({ error: authErr?.message ?? "Falha ao criar usuário" }, 400);
      const newUserId = created.user.id;

      // 2. create customer row
      const { data: customer, error: cErr } = await admin
        .from("customers")
        .insert({ name, email })
        .select("id")
        .single();
      if (cErr) {
        await admin.auth.admin.deleteUser(newUserId);
        return json({ error: cErr.message }, 400);
      }

      // 3. attach customer_id to profile (profile auto-created by trigger)
      // Wait briefly for trigger then upsert
      await admin.from("profiles").update({ customer_id: customer.id, status: "ativo" }).eq("user_id", newUserId);

      // 4. link companies
      if (Array.isArray(company_ids) && company_ids.length) {
        const rows = company_ids.map((cid: string) => ({ customer_id: customer.id, company_id: cid }));
        await admin.from("customer_companies").insert(rows);
      }

      return json({ ok: true, customer_id: customer.id, user_id: newUserId });
    }

    if (action === "reset_password") {
      const { user_id, password } = body;
      if (!user_id || !password || String(password).length < 6) return json({ error: "Dados inválidos" }, 400);
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "set_status") {
      const { user_id, status } = body;
      if (!user_id || !["ativo", "bloqueado"].includes(status)) return json({ error: "Dados inválidos" }, 400);
      await admin.from("profiles").update({ status }).eq("user_id", user_id);
      // ban via auth
      await admin.auth.admin.updateUserById(user_id, {
        ban_duration: status === "bloqueado" ? "876000h" : "none",
      });
      return json({ ok: true });
    }

    if (action === "delete") {
      const { user_id, customer_id } = body;
      if (!user_id || !customer_id) return json({ error: "Dados inválidos" }, 400);
      await admin.from("customer_companies").delete().eq("customer_id", customer_id);
      await admin.from("profiles").update({ customer_id: null }).eq("user_id", user_id);
      await admin.from("customers").delete().eq("id", customer_id);
      await admin.auth.admin.deleteUser(user_id);
      return json({ ok: true });
    }

    if (action === "set_companies") {
      const { customer_id, company_ids } = body;
      if (!customer_id || !Array.isArray(company_ids)) return json({ error: "Dados inválidos" }, 400);
      await admin.from("customer_companies").delete().eq("customer_id", customer_id);
      if (company_ids.length) {
        const rows = company_ids.map((cid: string) => ({ customer_id, company_id: cid }));
        const { error } = await admin.from("customer_companies").insert(rows);
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === "list") {
      const { data: customers, error: lErr } = await admin
        .from("customers")
        .select("id, name, email, created_at")
        .order("created_at", { ascending: false });
      if (lErr) return json({ error: lErr.message }, 400);

      const ids = customers?.map((c) => c.id) ?? [];
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, customer_id, status, email")
        .in("customer_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const { data: links } = await admin
        .from("customer_companies")
        .select("customer_id, company_id")
        .in("customer_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

      const enriched = (customers ?? []).map((c) => {
        const p = profiles?.find((x) => x.customer_id === c.id);
        return {
          ...c,
          user_id: p?.user_id ?? null,
          status: p?.status ?? "ativo",
          company_ids: (links ?? []).filter((l) => l.customer_id === c.id).map((l) => l.company_id),
        };
      });
      return json({ customers: enriched });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});