import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Sector {
  id: string;
  name: string;
  company_id: string | null;
}

interface UserSectors {
  sectors: Sector[];
  allSectors: Sector[];
  loading: boolean;
  isAdmin: boolean;
  /** Check if user has access to a specific sector (admins always true) */
  hasSector: (sectorId: string) => boolean;
  /** Reload sectors from DB */
  refresh: () => Promise<void>;
}

export function useUserSectors(): UserSectors {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [allSectors, setAllSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchSectors = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Check admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const admin = (roles ?? []).some((r: any) => r.role === "admin");
      setIsAdmin(admin);

      // Load all sectors for the company
      const { data: allSec } = await supabase
        .from("sectors")
        .select("*")
        .order("name");
      setAllSectors((allSec as Sector[]) ?? []);

      if (admin) {
        // Admins see all sectors
        setSectors((allSec as Sector[]) ?? []);
      } else {
        // Load user's assigned sectors
        const { data: userSec } = await supabase
          .from("user_sectors")
          .select("sector_id")
          .eq("user_id", user.id);

        const sectorIds = (userSec ?? []).map((us: any) => us.sector_id);
        setSectors((allSec as Sector[] ?? []).filter(s => sectorIds.includes(s.id)));
      }
    } catch (err) {
      console.error("[useUserSectors] error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSectors(); }, []);

  const hasSector = (sectorId: string) => {
    if (isAdmin) return true;
    return sectors.some(s => s.id === sectorId);
  };

  return { sectors, allSectors, loading, isAdmin, hasSector, refresh: fetchSectors };
}
