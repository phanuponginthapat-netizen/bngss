// Syncs values from Deno env vars (project-level secrets) into the app_secrets DB
// so the admin Secrets page reflects what's actually available at runtime.
// Called by SecretsManagementPage on mount so freshly-remixed projects show
// auto-provisioned VAPID/CRON keys as "ตั้งแล้ว" without operator action.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Secret names that may exist as project env vars and should mirror into app_secrets.
const SYNCABLE = [
  "CRON_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "LINE_CHANNEL_SECRET",
  "RESEND_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DEEPSEEK_API_KEY",
  "DASHSCOPE_API_KEY",
  "FB_PAGE_ACCESS_TOKEN",
  "FB_PAGE_ID",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, srv);

  const synced: string[] = [];
  for (const key of SYNCABLE) {
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
    } catch (_) {
      /* ignore per-key errors */
    }
  }

  return new Response(JSON.stringify({ ok: true, synced }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
