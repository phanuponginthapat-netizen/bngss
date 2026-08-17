// WizMind / CCTV face-event bridge
// รับ snapshot ใบหน้าที่กล้อง (หรือ bridge service) crop มาแล้ว → เก็บลง storage
// → insert แถวใน public.camera_face_events → Kiosk รับผ่าน realtime ทันที
//
// รองรับ 3 รูปแบบ body:
//   1) raw image (Content-Type: image/jpeg|png|webp)
//   2) multipart/form-data (field: file|image|snapshot + camera_id, ...)
//   3) application/json { camera_id, image_base64|image_url, bbox, confidence, ... }
//
// Auth: header `x-bridge-key` (หรือ ?key=) เทียบกับ secret WIZMIND_BRIDGE_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSecret } from "../_shared/getSecret.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bridge-key, x-camera-id, x-camera-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function extFor(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const provided = req.headers.get("x-bridge-key") || url.searchParams.get("key") || "";
  let expected = (await getSecret("WIZMIND_BRIDGE_KEY")) || Deno.env.get("WIZMIND_BRIDGE_KEY") || "";
  if (!expected) {
    // สร้างคีย์ให้อัตโนมัติในการเรียกครั้งแรก (ดูค่าได้ที่หน้า Secrets ของระบบ)
    try { expected = await generateWizmindBridgeKey(); } catch { /* ignore */ }
    if (!expected) return json({ error: "bridge_key_not_configured" }, 503);
    return json({ error: "bridge_key_provisioned", hint: "คีย์ถูกสร้างใหม่แล้ว — ดูค่าที่หน้าตั้งค่า Secrets (WIZMIND_BRIDGE_KEY)" }, 401);
  }
  if (provided !== expected) return json({ error: "unauthorized" }, 401);


  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  const ctype = (req.headers.get("content-type") || "").toLowerCase();
  let bytes: Uint8Array | null = null;
  let mime = "image/jpeg";
  let cameraId = req.headers.get("x-camera-id") || url.searchParams.get("camera_id") || "";
  let cameraName = req.headers.get("x-camera-name") || url.searchParams.get("camera_name") || "";
  let confidence: number | null = null;
  let bbox: unknown = null;
  let meta: Record<string, unknown> = {};
  let eventType = "face_detected";

  try {
    if (ctype.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const f = (form.get("file") || form.get("image") || form.get("snapshot")) as File | null;
      if (f) {
        bytes = new Uint8Array(await f.arrayBuffer());
        mime = f.type || mime;
      }
      cameraId = String(form.get("camera_id") || cameraId);
      cameraName = String(form.get("camera_name") || cameraName || "");
      const c = form.get("confidence");
      if (c != null && c !== "") confidence = Number(c);
      const bb = form.get("bbox");
      if (typeof bb === "string" && bb) { try { bbox = JSON.parse(bb); } catch { /* ignore */ } }
      const et = form.get("event_type");
      if (typeof et === "string" && et) eventType = et;
    } else if (ctype.startsWith("application/json")) {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      cameraId = String((body as any).camera_id ?? cameraId);
      cameraName = String((body as any).camera_name ?? cameraName ?? "");
      confidence = (body as any).confidence != null ? Number((body as any).confidence) : null;
      bbox = (body as any).bbox ?? null;
      meta = ((body as any).meta as Record<string, unknown>) ?? {};
      if ((body as any).event_type) eventType = String((body as any).event_type);
      const b64 = (body as any).image_base64 || (body as any).image;
      if (typeof b64 === "string" && b64.length > 64) {
        bytes = b64ToBytes(b64);
        const m = /^data:([^;]+);base64,/.exec(b64);
        if (m) mime = m[1];
      } else if (typeof (body as any).image_url === "string") {
        // ดึงภาพจาก snapshot URL ของกล้อง (bridge อยู่ในวงแลนเดียวกัน จึงมักส่ง base64 มากกว่า)
        const r = await fetch((body as any).image_url);
        if (r.ok) {
          bytes = new Uint8Array(await r.arrayBuffer());
          mime = r.headers.get("content-type") || mime;
        }
      }
    } else if (ctype.startsWith("image/")) {
      bytes = new Uint8Array(await req.arrayBuffer());
      mime = ctype.split(";")[0];
      const c = url.searchParams.get("confidence");
      if (c) confidence = Number(c);
    } else {
      // กล้องบางรุ่นส่ง body เป็น binary โดยไม่ตั้ง content-type
      bytes = new Uint8Array(await req.arrayBuffer());
    }
  } catch (e) {
    return json({ error: "bad_request", detail: String(e) }, 400);
  }

  if (!cameraId) cameraId = "unknown";
  if (!bytes || bytes.byteLength < 512) return json({ error: "no_image" }, 400);
  if (bytes.byteLength > 5 * 1024 * 1024) return json({ error: "image_too_large" }, 413);

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const safeCam = cameraId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48) || "cam";
  const path = `${day}/${safeCam}/${now.getTime()}-${crypto.randomUUID().slice(0, 8)}.${extFor(mime)}`;

  const { error: upErr } = await admin.storage
    .from("camera-events")
    .upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "60" });
  if (upErr) return json({ error: "upload_failed", detail: upErr.message }, 500);

  const { data: row, error: insErr } = await admin
    .from("camera_face_events")
    .insert({
      camera_id: cameraId,
      camera_name: cameraName || null,
      source: "wizmind",
      event_type: eventType,
      snapshot_path: path,
      confidence: Number.isFinite(confidence as number) ? confidence : null,
      bbox: bbox ?? null,
      meta,
    })
    .select("id, created_at")
    .single();
  if (insErr) return json({ error: "insert_failed", detail: insErr.message }, 500);

  // signed URL ให้ bridge ตรวจสอบภาพได้ทันที (อายุ 10 นาที)
  const { data: signed } = await admin.storage.from("camera-events").createSignedUrl(path, 600);

  return json({
    ok: true,
    id: row.id,
    created_at: row.created_at,
    snapshot_path: path,
    snapshot_url: signed?.signedUrl ?? null,
    bytes: bytes.byteLength,
  });
});
