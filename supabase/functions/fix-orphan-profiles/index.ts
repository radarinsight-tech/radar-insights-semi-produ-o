import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // List all auth users
    const { data: authData, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;

    // Get all profile IDs
    const { data: profiles } = await adminClient.from("profiles").select("id");
    const profileIds = new Set((profiles || []).map((p: any) => p.id));

    // Get default company
    const { data: company } = await adminClient.from("companies").select("id").limit(1).single();

    // Find orphans (created in last 24h for safety)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const orphans = authData.users.filter(
      (u) => !profileIds.has(u.id) && u.created_at > oneDayAgo
    );

    const results = [];
    for (const user of orphans) {
      const fullName = user.user_metadata?.full_name || user.email || "";
      const { error: insertErr } = await adminClient.from("profiles").insert({
        id: user.id,
        full_name: fullName,
        company_id: company?.id || null,
        active: true,
        force_password_change: true,
      });
      results.push({
        id: user.id,
        email: user.email,
        full_name: fullName,
        fixed: !insertErr,
        error: insertErr?.message || null,
      });
    }

    return new Response(JSON.stringify({ total_orphans: orphans.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
