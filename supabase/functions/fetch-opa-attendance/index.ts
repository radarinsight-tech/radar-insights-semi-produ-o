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
      limit = 1000, // Aumentado de 50 para 1000 para evitar paginação incorreta
      offset = 0 
    } = body as { 
      filters?: Record<string, unknown>; 
      limit?: number; 
      offset?: number;
    };

    console.log("fetch-opa-attendance: Request received", {
      user_id: user.id,
      filters,
      limit,
      offset,
      timestamp: new Date().toISOString()
    });

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
        `,
        { count: 'exact' }
      )
      .order("data_atendimento", { ascending: false })
      .range(offset, offset + limit - 1);

    // Log total count before filters
    const { count: totalBeforeFilters } = await supabase
      .from("evaluations")
      .select("*", { count: 'exact', head: true });

    console.log("fetch-opa-attendance: Total records in database before filters:", totalBeforeFilters);

    // Check for specific status distributions to identify potential filtering issues
    const { data: statusCheck } = await supabase
      .from("evaluations")
      .select("status_atendimento, status_auditoria")
      .limit(1000);

    const statusCounts = statusCheck?.reduce((acc, record) => {
      const status = record.status_atendimento || 'null';
      const auditStatus = record.status_auditoria || 'null';
      acc[status] = (acc[status] || 0) + 1;
      acc[`audit_${auditStatus}`] = (acc[`audit_${auditStatus}`] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    console.log("fetch-opa-attendance: Status distribution sample:", statusCounts);

    // Check for date range issues
    const { data: dateCheck } = await supabase
      .from("evaluations")
      .select("data_atendimento")
      .order("data_atendimento", { ascending: false })
      .limit(5);

    const { data: oldDateCheck } = await supabase
      .from("evaluations")
      .select("data_atendimento")
      .order("data_atendimento", { ascending: true })
      .limit(5);

    console.log("fetch-opa-attendance: Most recent dates:", dateCheck?.map(r => r.data_atendimento));
    console.log("fetch-opa-attendance: Oldest dates:", oldDateCheck?.map(r => r.data_atendimento));

    // Apply filters if provided
    if (filters.protocolo) {
      query = query.ilike("protocolo", `%${filters.protocolo}%`);
      console.log("fetch-opa-attendance: Applied protocolo filter:", filters.protocolo);
    }
    if (filters.cliente) {
      query = query.ilike("cliente", `%${filters.cliente}%`);
      console.log("fetch-opa-attendance: Applied cliente filter:", filters.cliente);
    }
    if (filters.atendente) {
      query = query.ilike("atendente", `%${filters.atendente}%`);
      console.log("fetch-opa-attendance: Applied atendente filter:", filters.atendente);
    }
    if (filters.status_atendimento) {
      query = query.eq("status_atendimento", filters.status_atendimento);
      console.log("fetch-opa-attendance: Applied status_atendimento filter:", filters.status_atendimento);
    }
    if (filters.status_auditoria) {
      query = query.eq("status_auditoria", filters.status_auditoria);
      console.log("fetch-opa-attendance: Applied status_auditoria filter:", filters.status_auditoria);
    }

    // Check if there are any rigid filters (status = 'F' or similar)
    console.log("fetch-opa-attendance: No rigid filters applied - all records should be accessible");

    // Execute query with RLS applied
    const { data, error, count } = await query;

    console.log("fetch-opa-attendance: Query executed", {
      records_found: data?.length || 0,
      total_after_filters: count,
      total_before_filters: totalBeforeFilters,
      applied_filters: Object.keys(filters).filter(key => filters[key] !== undefined && filters[key] !== ""),
      offset,
      limit
    });

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
        total_before_filters: totalBeforeFilters,
        limit,
        offset,
        user_id: user.id,
        debug_info: {
          records_returned: data?.length || 0,
          total_after_filters: count,
          total_before_filters: totalBeforeFilters,
          applied_filters: Object.keys(filters).filter(key => filters[key] !== undefined && filters[key] !== ""),
          has_rigid_filters: false,
          timestamp: new Date().toISOString()
        }
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
