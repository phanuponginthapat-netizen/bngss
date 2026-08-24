// Uploads a custom LINE Rich Menu image (per role) supplied by an admin from
// the web UI. Replaces the auto-generated SVG menu for that role and records
// the state so setup-line-richmenu will not overwrite it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

const ROLES = ["default", "parent", "teacher", "director", "admin"];

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const lineFetch = (token: string, path: string, init?: RequestInit) =>
  fetch(`https://api.line.me/v2/bot${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });

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
    if (!(roles || []).some((r: any) => ["admin", "director"].includes(String(r.role)))) {
      return json({ error: "forbidden" }, 403);
    }

    const body = await req.json();
    const role = String(body?.role || "");
    if (!ROLES.includes(role)) return json({ error: `role ไม่ถูกต้อง: ${role}` }, 400);
    if (!body?.image_base64) return json({ error: "image_base64 is required" }, 400);
    const areas = body?.areas;
    if (!Array.isArray(areas) || areas.length === 0) return json({ error: "areas ไม่ถูกต้อง" }, 400);
    const height = Number(body?.height) === 843 ? 843 : 1686;

    const { data: tok } = await admin.from("school_settings")
      .select("setting_value").eq("setting_key", "line_channel_access_token").maybeSingle();
    const token = tok?.setting_value;
    if (!token) return json({ error: "ยังไม่ได้ตั้งค่า LINE token" }, 400);

    const png = decodeBase64(String(body.image_base64));
    if (png.byteLength > 1024 * 1024) return json({ error: "รูปต้องไม่เกิน 1MB ตามข้อกำหนดของ LINE" }, 413);

    const hash = await sha256Hex(`upload:${role}:${height}:${JSON.stringify(areas)}:${png.byteLength}`);
    const { data: cur } = await admin.from("line_richmenu_state")
      .select("richmenu_id, content_hash, source").eq("role", role).maybeSingle();
    if (cur?.content_hash === hash && cur?.richmenu_id) {
      const chk = await lineFetch(token, `/richmenu/${cur.richmenu_id}`);
      if (chk.ok) return json({ skipped: true, richmenu_id: cur.richmenu_id });
    }

    // 1) create rich menu
    const createRes = await lineFetch(token, "/richmenu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        size: { width: 2500, height },
        selected: true,
        name: `Smart School • ${role} (upload)`,
        chatBarText: String(body?.chatBarText || "เมนู"),
        areas,
      }),
    });
    if (!createRes.ok) return json({ error: `สร้างเมนูไม่สำเร็จ: ${(await createRes.text()).slice(0, 300)}` }, 400);
    const { richMenuId } = await createRes.json();

    // 2) upload the image
    const upRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
      body: png,
    });
    if (!upRes.ok) {
      await lineFetch(token, `/richmenu/${richMenuId}`, { method: "DELETE" });
      return json({ error: `อัปโหลดรูปไม่สำเร็จ: ${(await upRes.text()).slice(0, 300)}` }, 400);
    }

    // 3) keep a copy in storage (best effort)
    const imagePath = `richmenu/${role}-${Date.now()}.png`;
    await admin.storage.from("line-richmenu").upload(imagePath, png, { contentType: "image/png", upsert: true })
      .catch(() => null);

    // 4) remove the previous menu for this role and persist state
    if (cur?.richmenu_id && cur.richmenu_id !== richMenuId) {
      await lineFetch(token, `/richmenu/${cur.richmenu_id}`, { method: "DELETE" }).catch(() => null);
    }
    await admin.from("line_richmenu_state").upsert({
      role,
      richmenu_id: richMenuId,
      content_hash: hash,
      source: "upload",
      image_path: imagePath,
      updated_at: new Date().toISOString(),
    }, { onConflict: "role" });

    await admin.from("school_settings").upsert(
      { setting_key: `line_richmenu_${role}`, setting_value: richMenuId },
      { onConflict: "setting_key" },
    );

    if (role === "default") {
      await lineFetch(token, `/user/all/richmenu/${richMenuId}`, { method: "POST" }).catch(() => null);
    }

    return json({ ok: true, richmenu_id: richMenuId, image_path: imagePath });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
