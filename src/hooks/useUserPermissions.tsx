import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isTest } from "@/lib/appMode";

export type ModulePermission = "auditoria" | "credito" | "admin" | "credit_manual" | "credit_upload";

interface UserPermissions {
  roles: ModulePermission[];
  loading: boolean;
  canAccess: (module: ModulePermission) => boolean;
  isAdmin: boolean;
  hasCreditManual: boolean;
  hasCreditUpload: boolean;
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

  const hasCreditManual = isAdmin || roles.includes("credit_manual");
  const hasCreditUpload = isAdmin || roles.includes("credit_upload");

  const canAccess = (module: ModulePermission): boolean => {
    if (isAdmin) return true;
    if (module === "credito") {
      // User has credit access if they have the base 'credito' role OR any credit sub-permission
      return roles.includes("credito") || roles.includes("credit_manual") || roles.includes("credit_upload");
    }
    return roles.includes(module);
  };

  return { roles, loading, canAccess, isAdmin, hasCreditManual, hasCreditUpload };
}
