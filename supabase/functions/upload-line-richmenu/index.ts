// Upload a custom Rich Menu image per role.
// - Dedups by SHA-256 hash of image bytes + areas JSON + role
// - Stores image in `line-richmenu` bucket
// - Creates Rich Menu on LINE, uploads content, updates state
// - If role='default' → also sets as default menu for all users

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ROLES = ["default", "parent", "teacher", "director", "admin"] as const;
type Role = typeof ROLES[number];

type Area = {
  bounds: { x: number; y: number; width: number; height: number };
  action:
    | { type: "message"; text: string }
    | { type: "uri"; uri: string }
    | { type: "postback"; data: string; displayText?: string };
};

const CHAT_BAR: Record<Role, string> = {
  default: "✨ เริ่มต้นใช้งาน",
  parent: "📚 เมนูนักเรียน/ผู้ปกครอง",
  teacher: "👨‍🏫 เมนูครู",
  director: "🎖 เมนูผู้อำนวยการ",
  admin: "🏫 เมนูแอดมิน",
};

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function lineFetch(token: string, path: string, init?: RequestInit) {
  return fetch(`https://api.line.me/v2/bot${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sbUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await sbUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "director");
    if (!isAdmin) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const role = body.role as Role;
    const imageBase64 = body.image_base64 as string;
    const areas = body.areas as Area[];
    const height = Number(body.height || 1686); // 1686 (full) or 843 (compact)

    if (!ROLES.includes(role)) return new Response(JSON.stringify({ error: "invalid role" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!imageBase64 || typeof imageBase64 !== "string") return new Response(JSON.stringify({ error: "image_base64 required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!Array.isArray(areas) || areas.length < 1 || areas.length > 20) return new Response(JSON.stringify({ error: "areas must be 1-20 items" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (![843, 1686].includes(height)) return new Response(JSON.stringify({ error: "height must be 843 or 1686" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const bytes = base64ToBytes(imageBase64);
    if (bytes.length > 1024 * 1024) return new Response(JSON.stringify({ error: "image must be ≤ 1MB" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (bytes.length < 8) return new Response(JSON.stringify({ error: "image invalid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Detect content type from magic bytes
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isPng && !isJpg) return new Response(JSON.stringify({ error: "image must be PNG or JPEG" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const contentType = isPng ? "image/png" : "image/jpeg";

    // Dedup hash: bytes + areas + role + size
    const areasJson = JSON.stringify(areas);
    const combo = new Uint8Array(bytes.length + areasJson.length + role.length + 8);
    combo.set(bytes, 0);
    combo.set(new TextEncoder().encode(areasJson + role + height), bytes.length);
    const hash = await sha256Hex(combo);

    const { data: current } = await sb.from("line_richmenu_state").select("*").eq("role", role).maybeSingle();
    if (current?.content_hash === hash && current?.richmenu_id) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "unchanged", richmenu_id: current.richmenu_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // LINE token
    const { data: tok } = await sb.from("school_settings").select("setting_value").eq("setting_key", "line_channel_access_token").maybeSingle();
    const token = tok?.setting_value;
    if (!token) throw new Error("LINE token not configured");

    // Upload image to storage
    const ext = isPng ? "png" : "jpg";
    const path = `${role}.${ext}`;
    const up = await sb.storage.from("line-richmenu").upload(path, bytes, { upsert: true, contentType });
    if (up.error) throw new Error("storage upload: " + up.error.message);

    // Create Rich Menu on LINE
    const richMenu = {
      size: { width: 2500, height },
      selected: role === "default",
      name: `Custom • ${role}`,
      chatBarText: CHAT_BAR[role],
      areas,
    };
    const createRes = await lineFetch(token, "/richmenu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(richMenu),
    });
    if (!createRes.ok) throw new Error(`LINE create: ${await createRes.text()}`);
    const { richMenuId } = await createRes.json();

    // Upload image content
    const upRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
      body: bytes,
    });
    if (!upRes.ok) {
      // rollback: delete the created richmenu
      await lineFetch(token, `/richmenu/${richMenuId}`, { method: "DELETE" });
      throw new Error(`LINE upload content: ${await upRes.text()}`);
    }

    // Delete previous menu for this role
    if (current?.richmenu_id) {
      await lineFetch(token, `/richmenu/${current.richmenu_id}`, { method: "DELETE" });
    }

    // Set as default menu if role='default'
    if (role === "default") {
      await lineFetch(token, `/user/all/richmenu/${richMenuId}`, { method: "POST" });
    }

    // Upsert state + settings
    await sb.from("line_richmenu_state").upsert({
      role,
      richmenu_id: richMenuId,
      content_hash: hash,
      source: "upload",
      image_path: path,
      updated_at: new Date().toISOString(),
    }, { onConflict: "role" });

    await sb.from("school_settings").upsert(
      { setting_key: `line_richmenu_${role}`, setting_value: richMenuId },
      { onConflict: "setting_key" },
    );

    return new Response(JSON.stringify({ ok: true, richmenu_id: richMenuId, size: bytes.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("upload-line-richmenu error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
