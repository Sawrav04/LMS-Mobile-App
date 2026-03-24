import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import type { User } from "../lib/auth";

export function useUsers(role?: string) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      let query = supabase.from("profiles").select("*");
      if (role) query = query.eq("role", role);
      query = query.order("created_at", { ascending: false });

      const { data, error: err } = await query;
      if (err) throw new Error(err.message);

      setUsers(
        (data || []).map((p: any) => ({
          ...p,
          createdAt: p.created_at,
        }))
      );
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, 5000);
      return () => clearInterval(interval);
    }, [load])
  );

  return { users, loading, error, refresh: load };
}
