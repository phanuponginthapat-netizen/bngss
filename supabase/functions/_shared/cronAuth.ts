// Shared guard for cron-only / internal edge functions.
// Accepts either:
//  - x-cron-secret header equal to CRON_SECRET, OR
//  - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (for internal function-to-function calls)
import { getSecret } from "./getSecret.ts";
import { secretKeys } from "./secretKeys.ts";

export async function isAuthorizedCron(req: Request): Promise<boolean> {
  const cronSecret = await getSecret(secretKeys.cron);
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) return true;

  const auth = req.headers.get("Authorization") ?? "";
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (srv && auth === `Bearer ${srv}`) return true;
  return false;
}

// Allow cron/service OR any signed-in user (blocks fully-anonymous abuse).
export async function isAuthorizedUserOrCron(req: Request): Promise<boolean> {
  if (await isAuthorizedCron(req)) return true;
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data, error } = await sb.auth.getClaims(token);
    return !error && !!data?.claims?.sub;
  } catch { return false; }
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    },
  });
}

// Verifies caller is an authenticated admin/director or service-role/cron.
export async function isAuthorizedAdminOrCron(req: Request): Promise<boolean> {
  if (await isAuthorizedCron(req)) return true;
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return false;
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
    return (roles ?? []).some((r: any) => r.role === "admin" || r.role === "director");
  } catch {
    return false;
  }
}
