import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isTest } from "@/lib/appMode";

export type ModulePermission = "auditoria" | "credito" | "admin" | "credit_manual" | "credit_upload" | "mentoria_atendente";

interface UserPermissions {
  roles: ModulePermission[];
  loading: boolean;
  canAccess: (module: ModulePermission) => boolean;
  isAdmin: boolean;
  hasCreditManual: boolean;
  hasCreditUpload: boolean;
  isMentoriaAtendente: boolean;
  attendantId: string | null;
  attendantName: string | null;
}

async function bootstrapTestAccess() {
  if (!isTest) return;

  const { error } = await supabase.functions.invoke("bootstrap-test-access");
  if (error) {
    console.error("[useUserPermissions] bootstrap-test-access error:", error);
  }
}

export function useUserPermissions(): UserPermissions {
  const [roles, setRoles] = useState<ModulePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendantId, setAttendantId] = useState<string | null>(null);
  const [attendantName, setAttendantName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchRoles = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }

        await bootstrapTestAccess();

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          console.error("[useUserPermissions] role query error:", error);
        }

        if (!cancelled) {
          const userRoles = (data ?? []).map((row) => row.role as ModulePermission);
          setRoles(userRoles);

          // If mentoria_atendente, fetch attendant info
          if (userRoles.includes("mentoria_atendente")) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("attendant_id")
              .eq("id", user.id)
              .single();

            if (!cancelled && (profile as any)?.attendant_id) {
              setAttendantId((profile as any).attendant_id);
              const { data: att } = await supabase
                .from("attendants")
                .select("name")
                .eq("id", (profile as any).attendant_id)
                .single();
              if (!cancelled && att) {
                setAttendantName(att.name);
              }
            }
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchRoles();
    return () => {
      cancelled = true;
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const isMentoriaAtendente = roles.includes("mentoria_atendente");

  const hasCreditManual = isAdmin || roles.includes("credit_manual");
  const hasCreditUpload = isAdmin || roles.includes("credit_upload");

  const canAccess = (module: ModulePermission): boolean => {
    if (isAdmin) return true;
    // mentoria_atendente can ONLY access mentoria-preventiva
    if (isMentoriaAtendente && module === "mentoria_atendente") return true;
    if (isMentoriaAtendente) return false;
    if (module === "credito") {
      return roles.includes("credito") || roles.includes("credit_manual") || roles.includes("credit_upload");
    }
    return roles.includes(module);
  };

  return { roles, loading, canAccess, isAdmin, hasCreditManual, hasCreditUpload, isMentoriaAtendente, attendantId, attendantName };
}
