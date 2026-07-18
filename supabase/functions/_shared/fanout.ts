// Shared helper: POST to notify-fanout / notify-google-chat / notify-line with service-role auth.
// Consolidates the fetch-boilerplate that used to be inline across cron/report functions.

const SUPABASE_URL = () => Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function post(fn: string, body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const resp = await fetch(`${SUPABASE_URL()}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY()}`,
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, data };
  } catch (e: any) {
    console.error(`fanout: POST ${fn} failed:`, e?.message);
    return { ok: false, status: 0, data: { error: e?.message } };
  }
}

// ─── notify-fanout ────────────────────────────────────────────────────────────
export interface FanoutPayload {
  user_ids?: string[];
  /** if given, resolves to user_ids from user_roles (requires an `admin` client) */
  roles?: string[];
  title: string;
  body?: string;
  type?: string;
  severity?: "info" | "success" | "warning" | "critical";
  reference_id?: string | null;
  reference_type?: string | null;
  url?: string | null;
  image_url?: string | null;
  channels?: Array<"in_app" | "push" | "line" | "gchat">;
  gchat_categories?: string[];
  fields?: Record<string, string>;
  dedup_key?: string;
}

/** Fire-and-forget notify-fanout call. Returns response promise so callers can await/parallelize. */
export async function fanout(payload: FanoutPayload, admin?: any): Promise<Response | null> {
  let user_ids = payload.user_ids || [];
  if (payload.roles && payload.roles.length && admin) {
    const { data: rows } = await admin.from("user_roles").select("user_id").in("role", payload.roles);
    user_ids = [...new Set([...(user_ids || []), ...((rows ?? []).map((r: any) => r.user_id))])].filter(Boolean);
  }
  if (!user_ids.length) return null;

  const { roles: _drop, user_ids: _drop2, ...rest } = payload;
  try {
    return await fetch(`${SUPABASE_URL()}/functions/v1/notify-fanout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY()}`,
      },
      body: JSON.stringify({ user_ids, ...rest }),
    });
  } catch (e: any) {
    console.error("fanout failed:", e?.message);
    return null;
  }
}

// ─── notify-google-chat ───────────────────────────────────────────────────────
export interface GChatPayload {
  title: string;
  message?: string;
  notification_type?: string;
  severity?: "info" | "success" | "warning" | "critical";
  department?: string;
  fields?: Record<string, string>;
  url?: string;
  image_url?: string;
  reference_table?: string;
  reference_id?: string;
}

/** POST to notify-google-chat with service-role auth. */
export async function notifyGChat(payload: GChatPayload) {
  return post("notify-google-chat", { department: "all", severity: "info", ...payload });
}

// ─── notify-line ──────────────────────────────────────────────────────────────
export interface LinePayload {
  title: string;
  message: string;
  user_ids?: string[];
  roles?: string[];
  use_flex?: boolean;
  severity?: "info" | "success" | "warning" | "critical";
  notification_type?: string;
  action_url?: string;
  action_label?: string;
}

/** POST to notify-line with service-role auth. */
export async function notifyLine(payload: LinePayload) {
  return post("notify-line", payload);
}
