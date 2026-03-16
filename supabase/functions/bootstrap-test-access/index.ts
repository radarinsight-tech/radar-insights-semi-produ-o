import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_NAME = "Banda Turbo";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ error: "Configuração do backend incompleta" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Não autorizado" }, 401);
    }

    const ensureCompany = async () => {
      const { data: existingCompany, error: companyError } = await adminClient
        .from("companies")
        .select("id")
        .eq("name", COMPANY_NAME)
        .maybeSingle();

      if (companyError) throw companyError;
      if (existingCompany?.id) return existingCompany.id;

      const { data: createdCompany, error: createCompanyError } = await adminClient
        .from("companies")
        .insert({ name: COMPANY_NAME })
        .select("id")
        .single();

      if (createCompanyError) throw createCompanyError;
      return createdCompany.id;
    };

    const ensureProfile = async (targetUserId: string, fullName?: string | null) => {
      const { error } = await adminClient.from("profiles").upsert(
        {
          id: targetUserId,
          company_id: companyId,
          full_name: fullName ?? "",
        },
        { onConflict: "id" },
      );

      if (error) throw error;
    };

    const companyId = await ensureCompany();
    await ensureProfile(user.id, (user.user_metadata?.full_name as string | undefined) ?? user.email);

    const { count: adminCount, error: adminCountError } = await adminClient
      .from("user_roles")
      .select("id", { head: true, count: "exact" })
      .eq("role", "admin");

    if (adminCountError) throw adminCountError;

    let promotedUserId: string | null = null;

    if ((adminCount ?? 0) === 0) {
      const { data: usersPage, error: listUsersError } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (listUsersError) throw listUsersError;

      const firstUser = [...(usersPage.users ?? [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )[0];

      if (firstUser) {
        await ensureProfile(
          firstUser.id,
          (firstUser.user_metadata?.full_name as string | undefined) ?? firstUser.email,
        );

        const { error: promoteError } = await adminClient.from("user_roles").upsert(
          {
            user_id: firstUser.id,
            role: "admin",
          },
          {
            onConflict: "user_id,role",
            ignoreDuplicates: true,
          },
        );

        if (promoteError) throw promoteError;
        promotedUserId = firstUser.id;
      }
    }

    const { data: currentRoles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) throw rolesError;

    return json({
      success: true,
      currentUserId: user.id,
      promotedUserId,
      roles: (currentRoles ?? []).map(({ role }) => role),
    });
  } catch (error) {
    console.error("bootstrap-test-access error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Erro interno ao preparar permissões" },
      500,
    );
  }
});
