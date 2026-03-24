import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";
import { notify, notifyAllManagers } from "./notifications";

export type UserRole = "shipper" | "carrier" | "manager";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  full_name?: string;
  phone?: string;
  company_name?: string;
  created_at?: string;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, role: UserRole, fullName?: string) => Promise<User>;
  updateProfile: (data: { full_name?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as User;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).then((profile) => {
          setUser(profile);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user) {
        const profile = await fetchProfile(s.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw new Error(error.message);

      const profile = await fetchProfile(data.user.id);
      if (!profile) throw new Error("Profile not found");

      if (profile.role === "carrier" && profile.status === "pending") {
        await supabase.auth.signOut();
        throw new Error("Your carrier account is pending approval");
      }

      setUser(profile);
      return profile;
    },
    []
  );

  const signup = useCallback(
    async (email: string, password: string, role: UserRole, fullName?: string): Promise<User> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role } },
      });

      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("Signup failed");

      // Wait briefly for the trigger to create the profile
      await new Promise((r) => setTimeout(r, 500));

      const profile = await fetchProfile(data.user.id);
      if (!profile) throw new Error("Profile creation failed");

      // Persist full_name if provided
      if (fullName) {
        await supabase
          .from("profiles")
          .update({ full_name: fullName })
          .eq("id", data.user.id);
        profile.full_name = fullName;
      }

      if (profile.status === "pending") {
        await supabase.auth.signOut();
      } else {
        setUser(profile);
      }

      // Welcome notification by role
      if (profile.role === "carrier") {
        notify.carrier.welcome(profile.id);
        notifyAllManagers("manager_new_carrier");
      } else if (profile.role === "shipper") {
        notify.shipper.welcome(profile.id);
      } else if (profile.role === "manager") {
        notify.manager.welcome(profile.id);
      }

      return profile;
    },
    []
  );

  const updateProfile = useCallback(async (data: { full_name?: string }) => {
    if (!session?.user?.id) throw new Error("Not logged in");
    const { error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", session.user.id);
    if (error) throw new Error(error.message);
    setUser((prev) => (prev ? { ...prev, ...data } : prev));
  }, [session?.user?.id]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
