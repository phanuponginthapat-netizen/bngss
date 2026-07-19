// Syncs values set elsewhere into app_secrets so the Secrets page reflects
// what's actually available at runtime, no matter where it was entered:
//   1. Project env vars (auto-provisioned VAPID/CRON, or values pasted into
//      the platform-level secret store)
//   2. cms_settings rows for FB page credentials set from the Social Feed page
// Called by SecretsManagementPage on mount.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Only mirror secrets we actually read from code.
const SYNCABLE_ENV = [
  "CRON_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "LINE_LOGIN_CHANNEL_ID",
  "LINE_LIFF_CHANNEL_ID",
  "FB_PAGE_ACCESS_TOKEN",
  "FB_PAGE_ID",
  "ELEVENLABS_API_KEY",
];

// CMS-settings key → app_secrets key. Values set from other admin pages
// (Social Feed, CMS) get mirrored here so the Secrets page shows them as "set".
const CMS_MIRROR: Record<string, string> = {
  fb_page_access_token: "FB_PAGE_ACCESS_TOKEN",
  fb_page_id: "FB_PAGE_ID",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
