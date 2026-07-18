// Unified notification helper. Use everywhere instead of inserting into `notifications` directly.
// Fans out to: in-app, Web Push (PWA), LINE, and optionally Google Chat.
import { supabase } from "@/integrations/supabase/client";

export type NotifySeverity = "info" | "success" | "warning" | "critical";
export type NotifyChannel = "in_app" | "push" | "line" | "gchat";

export interface NotifyOptions {
  user_ids: string[];
  title: string;
  body?: string;
  type?: string;
  severity?: NotifySeverity;
  reference_id?: string | null;
  reference_type?: string | null;
  url?: string | null;
  channels?: NotifyChannel[];
  gchat_categories?: string[];
  dedup_key?: string;
}

/**
 * Fire-and-forget notification fan-out. Never throws — failures are logged server-side.
 */
export async function notify(opts: NotifyOptions): Promise<void> {
  try {
    if (!opts.user_ids?.length || !opts.title) return;
    const { data, error } = await supabase.functions.invoke("notify-fanout", { body: opts });
    if (error) throw error;
    if ((data as any)?.error) {
      throw new Error((data as any).error);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[notify] fanout failed", e);
  }
}

/** Convenience: notify all users with a given role. */
export async function notifyRole(
  role: "admin" | "director" | "teacher" | "student" | "parent" | "alumni",
  opts: Omit<NotifyOptions, "user_ids">,
): Promise<void> {
  const { data } = await supabase.from("user_roles").select("user_id").eq("role", role);
  const ids = (data ?? []).map((r: any) => r.user_id).filter(Boolean);
  if (ids.length === 0) return;
  await notify({ ...opts, user_ids: ids });
}
