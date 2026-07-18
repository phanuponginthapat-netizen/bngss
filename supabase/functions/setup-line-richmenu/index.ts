import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIZE = { width: 2500, height: 1686 };
const cellW = SIZE.width / 3;
const cellH = SIZE.height / 2;

type Cell = { label: string; sub: string; icon: string; gradient: [string, string]; text: string };

// Modern palette aligned to school system (indigo/violet primary + accents)
const G = {
  indigo:  ["#6366F1", "#4F46E5"] as [string, string],
  violet:  ["#8B5CF6", "#7C3AED"] as [string, string],
  emerald: ["#10B981", "#059669"] as [string, string],
  amber:   ["#F59E0B", "#D97706"] as [string, string],
  rose:    ["#F43F5E", "#E11D48"] as [string, string],
  sky:     ["#0EA5E9", "#0284C7"] as [string, string],
  pink:    ["#EC4899", "#DB2777"] as [string, string],
  slate:   ["#64748B", "#475569"] as [string, string],
};

const MENUS: Record<string, { name: string; chatBarText: string; cells: Cell[] }> = {
  parent: {
    name: "Smart School • Parent",
    chatBarText: "📚 เมนูผู้ปกครอง/นักเรียน",
    cells: [
      { label: "ผลการเรียน",  sub: "เกรด & คะแนน",     icon: "📊", gradient: G.violet,  text: "ผลการเรียน" },
      { label: "การเข้าเรียน", sub: "เช็คชื่อรายวัน",   icon: "✅", gradient: G.emerald, text: "การเข้าเรียน" },
      { label: "พฤติกรรม",    sub: "คะแนนความประพฤติ", icon: "⭐", gradient: G.amber,   text: "พฤติกรรม" },
      { label: "ส่งใบลา",     sub: "แจ้งลาออนไลน์",   icon: "📝", gradient: G.rose,    text: "ลา" },
      { label: "ตารางเรียน",  sub: "ตารางสัปดาห์",     icon: "📅", gradient: G.sky,     text: "ตารางสอน" },
      { label: "เมนูทั้งหมด", sub: "เปิดเมนูหลัก",     icon: "📋", gradient: G.indigo,  text: "เมนู" },
    ],
  },
  teacher: {
    name: "Smart School • Teacher",
    chatBarText: "👨‍🏫 เมนูครู",
    cells: [
      { label: "เช็คชื่อ",   sub: "บันทึกการมาเรียน", icon: "✅", gradient: G.emerald, text: "เช็คชื่อ" },
      { label: "วิชาของฉัน", sub: "รายวิชาที่สอน",   icon: "📚", gradient: G.violet,  text: "วิชาฉัน" },
      { label: "สรุปห้อง",   sub: "ภาพรวมห้องเรียน",  icon: "📊", gradient: G.sky,     text: "สรุปห้อง" },
      { label: "สอนแทน",     sub: "งานสอนแทน",       icon: "🔁", gradient: G.rose,    text: "สอนแทน" },
      { label: "ส่งใบลา",   sub: "ลาราชการ/ลาป่วย",  icon: "📝", gradient: G.amber,   text: "ลา" },
      { label: "เมนูทั้งหมด", sub: "เปิดเมนูหลัก",     icon: "📋", gradient: G.indigo,  text: "เมนู" },
    ],
  },
  default: {
    name: "Smart School • Welcome",
    chatBarText: "✨ เริ่มต้นใช้งาน",
    cells: [
      { label: "เชื่อมบัญชี", sub: "Link LINE ↔ Smart School", icon: "🔗", gradient: G.indigo,  text: "เชื่อม" },
      { label: "ข่าวสาร",    sub: "ประกาศโรงเรียน",            icon: "📰", gradient: G.pink,    text: "ข่าว" },
      { label: "ตารางเรียน", sub: "ตารางวันนี้",               icon: "📅", gradient: G.violet,  text: "ตารางสอน" },
      { label: "ติดต่อ",     sub: "โทร/แชทเจ้าหน้าที่",        icon: "📞", gradient: G.emerald, text: "ติดต่อ" },
      { label: "ช่วยเหลือ",  sub: "คำถามที่พบบ่อย",            icon: "❓", gradient: G.amber,   text: "เมนู" },
      { label: "เมนูทั้งหมด", sub: "เปิดเมนูหลัก",              icon: "📋", gradient: G.slate,   text: "เมนู" },
    ],
  },
};

function buildAreas(cells: Cell[]) {
  return cells.map((c, i) => ({
    bounds: {
      x: Math.round((i % 3) * cellW),
      y: Math.round(Math.floor(i / 3) * cellH),
      width: Math.round(cellW),
      height: Math.round(cellH),
    },
    action: { type: "message", text: c.text },
  }));
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BG_PROMPTS: Record<string, string> = {
  parent: "Ultra-modern abstract gradient background for a Thai school parent app menu. Soft violet, indigo and emerald flowing gradients, subtle bokeh lights, smooth glassmorphism shapes, 3:2 wide composition, premium tech feel, no text, no logos.",
  teacher: "Ultra-modern abstract gradient background for a Thai school teacher dashboard. Smooth emerald, sky blue and violet gradients with subtle geometric shapes and soft light flares, 3:2 wide composition, premium clean tech aesthetic, no text, no logos.",
  default: "Ultra-modern welcoming abstract gradient background for a Thai school LINE official account. Indigo, pink and amber flowing gradients with soft bokeh and subtle stars, 3:2 wide composition, friendly premium feel, no text, no logos.",
};

async function generateBgPng(role: string): Promise<Uint8Array | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: BG_PROMPTS[role] }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      console.error("AI bg gen failed", role, res.status, await res.text());
      return null;
    }
    const j = await res.json();
    const imgUrl: string | undefined = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imgUrl) return null;
    if (imgUrl.startsWith("data:")) {
      const b64 = imgUrl.split(",")[1];
      return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    }
    const imgRes = await fetch(imgUrl);
    return new Uint8Array(await imgRes.arrayBuffer());
  } catch (e) {
    console.error("AI bg gen error", role, e);
    return null;
  }
}

function buildSvg(cells: Cell[], bgPngB64: string | null): string {
  const pad = 28;
  const radius = 56;
  let defs = "";
  let cards = "";

  cells.forEach((c, i) => {
    const x = (i % 3) * cellW;
    const y = Math.floor(i / 3) * cellH;
    const gid = `g${i}`;
    defs += `
      <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c.gradient[0]}" stop-opacity="0.92"/>
        <stop offset="100%" stop-color="${c.gradient[1]}" stop-opacity="0.92"/>
      </linearGradient>`;
    const cx = x + cellW / 2;
    const cy = y + cellH / 2;
    cards += `
      <g filter="url(#shadow)">
        <rect x="${x + pad}" y="${y + pad}" width="${cellW - pad * 2}" height="${cellH - pad * 2}" rx="${radius}" fill="url(#${gid})"/>
      </g>
      <circle cx="${cx}" cy="${cy - 110}" r="120" fill="rgba(255,255,255,0.18)"/>
      <text x="${cx}" y="${cy - 80}" font-size="200" text-anchor="middle" dominant-baseline="middle">${c.icon}</text>
      <text x="${cx}" y="${cy + 130}" font-size="96" font-weight="800" fill="#FFFFFF" text-anchor="middle" font-family="'IBM Plex Sans Thai','Sarabun',sans-serif">${escapeXml(c.label)}</text>
      <text x="${cx}" y="${cy + 220}" font-size="56" font-weight="500" fill="rgba(255,255,255,0.82)" text-anchor="middle" font-family="'IBM Plex Sans Thai','Sarabun',sans-serif">${escapeXml(c.sub)}</text>
    `;
  });

  const bgLayer = bgPngB64
    ? `<image href="data:image/png;base64,${bgPngB64}" x="0" y="0" width="${SIZE.width}" height="${SIZE.height}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="${SIZE.width}" height="${SIZE.height}" fill="url(#bg)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE.width}" height="${SIZE.height}" viewBox="0 0 ${SIZE.width} ${SIZE.height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F8FAFC"/>
        <stop offset="100%" stop-color="#EEF2FF"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#1E293B" flood-opacity="0.22"/>
      </filter>
      ${defs}
    </defs>
    ${bgLayer}
    ${cards}
  </svg>`;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}


let wasmInit: Promise<any> | null = null;
async function svgToPng(svg: string): Promise<Uint8Array> {
  const mod = await import("https://esm.sh/@resvg/resvg-wasm@2.6.2");
  if (!wasmInit) {
    // @ts-ignore
    wasmInit = mod.initWasm(await fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm").then(r => r.arrayBuffer()));
  }
  await wasmInit;
  // @ts-ignore
  const resvg = new mod.Resvg(svg, { fitTo: { mode: "width", value: SIZE.width } });
  return resvg.render().asPng();
}

async function lineFetch(token: string, path: string, init?: RequestInit) {
  return fetch(`https://api.line.me/v2/bot${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
}

async function createMenu(token: string, role: string): Promise<string> {
  const cfg = MENUS[role];
  const richMenu = {
    size: SIZE,
    selected: true,
    name: cfg.name,
    chatBarText: cfg.chatBarText,
    areas: buildAreas(cfg.cells),
  };
  const createRes = await lineFetch(token, "/richmenu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(richMenu),
  });
  if (!createRes.ok) throw new Error(`create ${role}: ${await createRes.text()}`);
  const { richMenuId } = await createRes.json();

  const bgPng = await generateBgPng(role);
  const bgB64 = bgPng ? toBase64(bgPng) : null;
  const png = await svgToPng(buildSvg(cfg.cells, bgB64));
  const upRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
    body: png,
  });
  if (!upRes.ok) throw new Error(`upload ${role}: ${await upRes.text()}`);

  return richMenuId;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tok } = await sb.from("school_settings").select("setting_value").eq("setting_key", "line_channel_access_token").maybeSingle();
    const token = tok?.setting_value;
    if (!token) return new Response(JSON.stringify({ error: "LINE token not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Wipe all existing menus
    const listRes = await lineFetch(token, "/richmenu/list");
    if (listRes.ok) {
      const { richmenus } = await listRes.json();
      for (const rm of richmenus || []) {
        await lineFetch(token, `/richmenu/${rm.richMenuId}`, { method: "DELETE" });
      }
    }

    // Create 3 menus
    const ids: Record<string, string> = {};
    for (const role of ["default", "parent", "teacher"]) {
      ids[role] = await createMenu(token, role);
    }

    // Set default menu for everyone
    await lineFetch(token, `/user/all/richmenu/${ids.default}`, { method: "POST" });

    // Save IDs in settings (upsert each)
    for (const [role, id] of Object.entries(ids)) {
      const key = `line_richmenu_${role}`;
      await sb.from("school_settings").upsert({ setting_key: key, setting_value: id }, { onConflict: "setting_key" });
    }

    return new Response(JSON.stringify({ ok: true, ids }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("setup-line-richmenu error", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
