// One-click: create any missing critical storage buckets. Admin-only.
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BUCKET_CONFIG: Record<string, { public: boolean; fileSizeLimit?: number }> = {
  "profile-images": { public: true, fileSizeLimit: 5 * 1024 * 1024 },
  "cms-logos": { public: true, fileSizeLimit: 10 * 1024 * 1024 },
  "wall-media": { public: true, fileSizeLimit: 50 * 1024 * 1024 },
  "padlet-media": { public: true, fileSizeLimit: 25 * 1024 * 1024 },
  "documents": { public: false, fileSizeLimit: 25 * 1024 * 1024 },
  "backups": { public: false, fileSizeLimit: 500 * 1024 * 1024 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require admin JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const uid = claims?.claims?.sub;
    if (!uid) throw new Error("no session");

    const admin = makeAdmin();
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("admin only");

    const { data: existing } = await admin.storage.listBuckets();
    const have = new Set((existing ?? []).map((b: any) => b.name));

    const created: string[] = [];
    const failed: { name: string; error: string }[] = [];
    for (const [name, cfg] of Object.entries(BUCKET_CONFIG)) {
      if (have.has(name)) continue;
      const { error } = await admin.storage.createBucket(name, cfg);
      if (error) failed.push({ name, error: error.message });
      else created.push(name);
    }

    return new Response(JSON.stringify({ ok: true, created, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
