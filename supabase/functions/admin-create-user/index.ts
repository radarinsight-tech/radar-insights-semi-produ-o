import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await anonClient.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem criar usuários" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { email, password, fullName } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "E-mail e senha são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter no mínimo 6 caracteres" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const trimmedEmail = email.trim();

    // --- Check if user already exists in Auth ---
    let userId: string | null = null;

    const { data: listData } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = listData?.users?.find(
      (u: any) => u.email?.toLowerCase() === trimmedEmail.toLowerCase()
    );

    if (existingAuthUser) {
      // User exists in Auth — check if profile exists
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("id", existingAuthUser.id)
        .maybeSingle();

      if (existingProfile) {
        // Both Auth and profile exist — truly duplicate
        return new Response(
          JSON.stringify({ error: "Este e-mail já está cadastrado no sistema." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Auth exists but no profile — recover by creating profile
      userId = existingAuthUser.id;
      console.log("Recovering orphan Auth user (no profile):", userId);
    } else {
      // User does not exist — create in Auth
      const { data: newUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email: trimmedEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName || "" },
        });

      if (createError) {
        console.error("Create user error:", createError);
        const msg = createError.message?.includes("already been registered")
          ? "Este e-mail já está cadastrado no sistema."
          : "Erro ao criar usuário: " + createError.message;
        return new Response(JSON.stringify({ error: msg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser?.user?.id ?? null;
    }

    // --- Upsert profile to guarantee it exists ---
    if (userId) {
      const { error: upsertError } = await adminClient
        .from("profiles")
        .upsert(
          {
            id: userId,
            full_name: fullName || "",
            force_password_change: true,
          },
          { onConflict: "id" }
        );

      if (upsertError) {
        console.error("Profile upsert error:", upsertError);
        // Auth succeeded, so still return success — profile will be created by trigger or next attempt
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        message: "Usuário criado com sucesso",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
