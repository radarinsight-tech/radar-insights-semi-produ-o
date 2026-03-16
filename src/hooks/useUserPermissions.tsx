import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ModulePermission = "auditoria" | "credito" | "admin";

interface UserPermissions {
  roles: ModulePermission[];
  loading: boolean;
  canAccess: (module: "auditoria" | "credito") => boolean;
  isAdmin: boolean;
}

export function useUserPermissions(): UserPermissions {
  const [roles, setRoles] = useState<ModulePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchRoles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!cancelled) {
        const userRoles = (data ?? []).map((r) => r.role as ModulePermission);
        setRoles(userRoles);
        setLoading(false);
      }
    };

    fetchRoles();
    return () => { cancelled = true; };
  }, []);

  const isAdmin = roles.includes("admin");

  const canAccess = (module: "auditoria" | "credito"): boolean => {
    if (isAdmin) return true;
    return roles.includes(module);
  };

  return { roles, loading, canAccess, isAdmin };
}
