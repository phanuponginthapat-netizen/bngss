// One-time helper: copy this project's function secrets into the school's own
// Supabase project via the Management API. Values never leave the server side.
import { corsHeaders } from "../_shared/cors.ts";

const COPY_KEYS = [
  "ADMIN_EMAIL",
  "CRON_SECRET",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "PUBLIC_ORIGIN",
  "VAPID_PRIVATE_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_SUBJECT",
  "DASHSCOPE_API_KEY",
  "DEEPSEEK_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { pat, projectRef, extra } = await req.json();
    if (!pat || !projectRef) throw new Error("pat and projectRef are required");

    const secrets: { name: string; value: string }[] = [];
    for (const name of COPY_KEYS) {
      const value = Deno.env.get(name);
      if (value) secrets.push({ name, value });
    }
    if (extra && typeof extra === "object") {
      for (const [name, value] of Object.entries(extra as Record<string, string>)) {
        if (value) secrets.push({ name, value });
      }
    }

    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
      body: JSON.stringify(secrets),
    });
    const text = await res.text();

    return new Response(
      JSON.stringify({ ok: res.ok, status: res.status, pushed: secrets.map((s) => s.name), response: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
