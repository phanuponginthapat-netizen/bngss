import { supabase } from "@/integrations/supabase/client";

let pending: Promise<void> | null = null;

/** One refresh per client, even when focus/resume/online listeners fire together. */
export function refreshSessionIfNeeded(): Promise<void> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session || !session.expires_at) return;
      if (session.expires_at * 1000 - Date.now() < 5 * 60 * 1000) {
        await supabase.auth.refreshSession();
      }
    } catch {
      // Transient read/refresh failures must never initiate a sign-out.
    }
  })().finally(() => { pending = null; });
  return pending;
}