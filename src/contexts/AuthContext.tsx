import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role?: string | null;
  nickname?: string | null;
  province?: string | null;
  city?: string | null;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,user_id,full_name,email,phone,avatar_url,role,nickname,province,city")
      .eq("user_id", uid)
      .single();
    if (!error) setProfile(data as Profile);
  };

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUser(currentUser ?? null);
      if (currentUser) await loadProfile(currentUser.id);
      setLoading(false);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await loadProfile(u.id);
      else setProfile(null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOutSafe = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      // Force client-side cleanup to avoid sticky sessions
      try {
        localStorage.removeItem("sb-" + btoa("ickevbvqlzjnzzynohup") + "-auth-token");
      } catch (e) {
        // ignore
      }
      setUser(null);
      setProfile(null);
    }
  };

  const value = useMemo(
    () => ({ user, profile, loading, refreshProfile, signOut: signOutSafe }),
    [user, profile, loading, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
};
