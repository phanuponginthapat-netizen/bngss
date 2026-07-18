import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthSessionState {
  isReady: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;
}

export function useAuthSession() {
  const [state, setState] = useState<AuthSessionState>({
    isReady: false,
    session: null,
    user: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (!active) return;
      setState({
        isReady: true,
        session: null,
        user: null,
        error: "หมดเวลารอการยืนยันตัวตน กรุณาลองโหลดหน้าใหม่",
      });
    }, 8000);

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return;
      window.clearTimeout(timeout);
      setState({
        isReady: true,
        session,
        user: session?.user ?? null,
        error: error?.message ?? null,
      });
    }).catch((error) => {
      if (!active) return;
      window.clearTimeout(timeout);
      setState({
        isReady: true,
        session: null,
        user: null,
        error: error?.message || "โหลด session ไม่สำเร็จ",
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      window.clearTimeout(timeout);
      setState({
        isReady: true,
        session,
        user: session?.user ?? null,
        error: null,
      });
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  return state;
}