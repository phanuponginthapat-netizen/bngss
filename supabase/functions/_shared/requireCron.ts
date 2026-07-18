// Shared auth gate for cron-triggered edge functions.
// Accepts either:
//   1) x-cron-secret header matching the CRON_SECRET app secret, OR
//   2) a logged-in admin/director JWT (Authorization: Bearer <jwt>)
// Returns null when allowed, or a Response (401/403) to short-circuit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSecret } from "./getSecret.ts";
import { secretKeys } from "./secretKeys.ts";

export async function requireCronOrAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const cronSecret = await getSecret(secretKeys.cron);
  const provided = req.headers.get("x-cron-secret");
  if (cronSecret && provided && provided === cronSecret) return null;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const url = Deno.env.get("SUPABASE_URL")!;
      const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(url, anon, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: roles } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const ok = (roles ?? []).some((r: any) =>
          r.role === "admin" || r.role === "director" || r.role === "super_admin"
        );
        if (ok) return null;
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch { /* fall through to 401 */ }
  }

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
