import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";

export interface Statistics {
  totalShipments: number;
  pendingShipments: number;
  inTransitShipments: number;
  deliveredShipments: number;
  totalUsers: number;
  totalCarriers: number;
  approvedCarriers: number;
  pendingCarriers: number;
  totalShippers: number;
  totalManagers: number;
}

export function useStatistics() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_statistics");
      if (error) throw error;
      setStats(data as Statistics);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, 5000);
      return () => clearInterval(interval);
    }, [load])
  );

  return { stats, loading, refresh: load };
}
