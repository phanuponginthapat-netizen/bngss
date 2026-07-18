import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthSessionState {
  isReady: boolean;
  session: Session | null;
  user: User | null;
}

export function useAuthSession() {
  const [state, setState] = useState<AuthSessionState>({
    isReady: false,
    session: null,
    user: null,
  });

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setState({
        isReady: true,
        session,
        user: session?.user ?? null,
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState({
        isReady: true,
        session,
        user: session?.user ?? null,
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}