import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Extract authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ 
        error: "Unauthorized", 
        message: "Missing or invalid Bearer token" 
      }),
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's authorization (RLS enabled)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid permissions profile", 
          message: "Unable to verify user identity",
          details: authError?.message || "No user found"
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { 
      filters = {}, 
      limit = 50, 
      offset = 0 
    } = body as { 
      filters?: Record<string, unknown>; 
      limit?: number; 
      offset?: number;
    };

    // Build query for evaluations (attendances)
    let query = supabase
      .from("evaluations")
      .select(
        `
        id,
        protocolo,
        cliente,
        atendente,
        data_atendimento,
        status_atendimento,
        nota_final,
        status_auditoria,
        created_at,
        updated_at
        `
      )
      .order("data_atendimento", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters if provided
    if (filters.protocolo) {
      query = query.ilike("protocolo", `%${filters.protocolo}%`);
    }
    if (filters.cliente) {
      query = query.ilike("cliente", `%${filters.cliente}%`);
    }
    if (filters.atendente) {
      query = query.ilike("atendente", `%${filters.atendente}%`);
    }
    if (filters.status_atendimento) {
      query = query.eq("status_atendimento", filters.status_atendimento);
    }
    if (filters.status_auditoria) {
      query = query.eq("status_auditoria", filters.status_auditoria);
    }

    // Execute query with RLS applied
    const { data, error, count } = await query;

    if (error) {
      // Handle RLS permission errors
      if (error.code === "42501" || error.message?.includes("permission")) {
        return new Response(
          JSON.stringify({ 
            error: "Invalid permissions profile",
            message: "You don't have permission to access this data",
            code: error.code,
            details: error.message
          }),
          { 
            status: 403, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: data || [],
        total: count || 0,
        limit,
        offset,
        user_id: user.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("fetch-opa-attendance error:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
