// Server-side storage upload used as a fallback when the browser upload is
// rejected by storage RLS. Only staff (admin/director/teacher) may upload.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_BUCKETS = new Set([
  "cms", "cms-images", "public-assets", "avatars", "news", "documents",
  "uploads", "covers", "certificates", "print-templates", "line-richmenu",
]);

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const admin = makeAdmin();
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
    const allowed = (roles || []).some((r: any) =>
      ["admin", "director", "teacher", "staff"].includes(String(r.role)));
    if (!allowed) return json({ error: "forbidden" }, 403);

    const body = await req.json();
    const bucket = String(body?.bucket || "");
    const path = String(body?.path || "").replace(/^\/+/, "");
    if (!bucket || !path) return json({ error: "bucket and path are required" }, 400);
    if (!ALLOWED_BUCKETS.has(bucket)) return json({ error: `bucket not allowed: ${bucket}` }, 400);
    if (path.includes("..")) return json({ error: "invalid path" }, 400);
    if (!body?.base64) return json({ error: "base64 is required" }, 400);

    const bytes = decodeBase64(String(body.base64));
    if (bytes.byteLength > 15 * 1024 * 1024) return json({ error: "ไฟล์ใหญ่เกิน 15MB" }, 413);

    const { error: upErr } = await admin.storage.from(bucket).upload(path, bytes, {
      contentType: String(body?.contentType || "application/octet-stream"),
      upsert: body?.upsert !== false,
    });
    if (upErr) return json({ error: upErr.message }, 400);

    const { data: pub } = admin.storage.from(bucket).getPublicUrl(path);
    return json({ path, publicUrl: pub.publicUrl });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
