import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User } from "@supabase/supabase-js"; // Correct (added @)
import { supabase } from "../lib/supabaseClient";
import { posthog } from "../lib/posthogClient";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial auth state
    supabase.auth.getClaims().then(({ data }) => {
      const claims = data?.claims as unknown as User | null;
      setUser(claims ?? null);
      if (claims) {
        posthog.identify((claims as any).sub ?? claims.id);
      }
      setLoading(false);
      if (claims && "Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}
    });

    // Listen for login/logout events
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        posthog.identify(session.user.id);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [posthog]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);