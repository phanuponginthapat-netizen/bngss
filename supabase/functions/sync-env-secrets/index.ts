// Syncs values set elsewhere into app_secrets so the Secrets page reflects
// what's actually available at runtime, no matter where it was entered:
//   1. Project env vars (auto-provisioned VAPID/CRON, or values pasted into
//      the platform-level secret store)
//   2. cms_settings rows for FB page credentials set from the Social Feed page
// Called by SecretsManagementPage on mount.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

// Only mirror secrets we actually read from code.
const SYNCABLE_ENV = [
  "CRON_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "LINE_VAULT_CHANNEL_ACCESS_TOKEN",
  "LINE_LOGIN_CHANNEL_ID",
  "LINE_LIFF_CHANNEL_ID",
  "ELEVENLABS_API_KEY",
];

// CMS-settings key → app_secrets key. (Social Wall is URL-based now.)
const CMS_MIRROR: Record<string, string> = {};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // Auth: admin only
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const url0 = Deno.env.get("SUPABASE_URL")!;
  const srv0 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin0 = createClient(url0, srv0);
  const { data: u } = await admin0.auth.getUser(token);
  const { data: role } = await admin0.from("user_roles").select("role").eq("user_id", u.user?.id || "").maybeSingle();
  if (!u.user || !role || !["admin","director"].includes((role as any).role)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const url = Deno.env.get("SUPABASE_URL")!;
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, srv);

  const synced: string[] = [];

  // 1) env vars → app_secrets
  for (const key of SYNCABLE_ENV) {
    const value = Deno.env.get(key);
    if (!value) continue;
    try {
      await admin.rpc("set_app_secret", {
        _key: key,
        _value: value,
        _category: "auto",
        _description: `Synced from project secret (${key})`,
      });
      synced.push(key);
    } catch (_) { /* ignore */ }
  }

  // 2) cms_settings → app_secrets
  try {
    const { data } = await admin
      .from("cms_settings")
      .select("key,value")
      .in("key", Object.keys(CMS_MIRROR));
    for (const row of data ?? []) {
      const v = String((row as any).value ?? "").trim();
      if (!v) continue;
      const target = CMS_MIRROR[(row as any).key];
      if (!target) continue;
      try {
        await admin.rpc("set_app_secret", {
          _key: target,
          _value: v,
          _category: "social",
          _description: `Synced from CMS setting (${(row as any).key})`,
        });
        synced.push(target);
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }

  return new Response(JSON.stringify({ ok: true, synced }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
