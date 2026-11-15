// Shared caller authorization for edge functions.
// Accepts: service-role bearer (internal function-to-function), x-cron-secret (scheduled jobs),
// or a signed-in user whose user_roles include one of `roles` (any role when roles is empty).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSecret } from "./getSecret.ts";
import { secretKeys } from "./secretKeys.ts";

export type Caller = { kind: "service" | "cron" | "user"; userId: string | null; roles: string[] };

export interface AuthOptions {
  roles?: string[];
  allowService?: boolean;
  allowCron?: boolean;
}

function deny(status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: status === 401 ? "Unauthorized" : "Forbidden" }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export async function authorizeCaller(
  req: Request,
  cors: Record<string, string>,
  opts: AuthOptions = {},
): Promise<Caller | Response> {
  const { roles = [], allowService = true, allowCron = false } = opts;
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (allowService && token && serviceKey && token === serviceKey) {
    return { kind: "service", userId: null, roles: [] };
  }
  if (allowCron) {
    const provided = req.headers.get("x-cron-secret");
    if (provided) {
      const secret = await getSecret(secretKeys.cron).catch(() => null);
      if (secret && provided === secret) return { kind: "cron", userId: null, roles: [] };
    }
  }
  if (!token) return deny(401, cors);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return deny(401, cors);
  const { data: rows, error: roleErr } = await admin.from("user_roles").select("role").eq("user_id", data.user.id);
  if (roleErr) return deny(403, cors);
  const userRoles = (rows ?? []).map((r: { role: string }) => r.role);
  const ok = roles.length === 0 ? userRoles.length > 0 : userRoles.some((r) => roles.includes(r));
  if (!ok) return deny(403, cors);
  return { kind: "user", userId: data.user.id, roles: userRoles };
}

export const STAFF_ROLES = ["admin", "director", "teacher"];
export const ADMIN_ROLES = ["admin", "director"];
