import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { generateImage } from "../_shared/imageGen.ts";

const SIZE = { width: 2500, height: 1686 };
// 4 คอลัมน์ × 2 แถว = 8 เซลล์ต่อเมนู (LINE รองรับได้ถึง 20 areas)
const COLS = 4;
const ROWS = 2;
const cellW = SIZE.width / COLS;
const cellH = SIZE.height / ROWS;

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
  teal:    ["#14B8A6", "#0D9488"] as [string, string],
  orange:  ["#F97316", "#EA580C"] as [string, string],
};

const MENUS: Record<string, { name: string; chatBarText: string; cells: Cell[] }> = {
  // นักเรียน / ผู้ปกครอง — เน้นข้อมูลลูก/ตัวเอง
  parent: {
    name: "Smart School • Student & Parent",
    chatBarText: "📚 เมนูนักเรียน/ผู้ปกครอง",
    cells: [
      { label: "ผลการเรียน",   sub: "เกรด & คะแนน",       icon: "📊", gradient: G.violet,  text: "ผลการเรียน" },
      { label: "การเข้าเรียน",  sub: "เช็คชื่อรายวัน",     icon: "✅", gradient: G.emerald, text: "การเข้าเรียน" },
      { label: "การบ้าน",       sub: "งานที่ต้องส่ง",       icon: "📚", gradient: G.sky,     text: "การบ้าน" },
      { label: "พฤติกรรม",      sub: "คะแนนความประพฤติ",   icon: "⭐", gradient: G.amber,   text: "พฤติกรรม" },
      { label: "สุขภาพ",        sub: "บันทึกพยาบาล",       icon: "🏥", gradient: G.rose,    text: "สุขภาพ" },
      { label: "ส่งใบลา",       sub: "แจ้งลาออนไลน์",      icon: "📝", gradient: G.pink,    text: "ลา" },
      { label: "ตารางเรียน",    sub: "ตารางสัปดาห์",        icon: "📅", gradient: G.teal,    text: "ตารางสอน" },
      { label: "เมนูทั้งหมด",   sub: "เปิดเมนูหลัก",         icon: "📋", gradient: G.indigo,  text: "เมนู" },
    ],
  },
  // ครู / บุคลากร — เน้นงานสอนและงานประจำวัน
  teacher: {
    name: "Smart School • Teacher",
    chatBarText: "👨‍🏫 เมนูครู",
    cells: [
      { label: "เช็คเข้าแถว",  sub: "หน้าห้องประจำชั้น",  icon: "🚩", gradient: G.emerald, text: "เช็คเข้าแถว" },
      { label: "เช็ครายคาบ",   sub: "ตามคาบสอน",           icon: "🕐", gradient: G.teal,    text: "เช็ครายคาบ" },
      { label: "วิชาของฉัน",   sub: "รายวิชาที่สอน",        icon: "📚", gradient: G.violet,  text: "วิชาฉัน" },
      { label: "สรุปห้อง",     sub: "ภาพรวมห้องเรียน",     icon: "📊", gradient: G.sky,     text: "สรุปห้อง" },
      { label: "การบ้านฉัน",   sub: "งานที่มอบหมาย",       icon: "📝", gradient: G.amber,   text: "การบ้านฉัน" },
      { label: "สอนแทน",       sub: "งานสอนแทน",           icon: "🔁", gradient: G.rose,    text: "สอนแทน" },
      { label: "ส่งใบลา",      sub: "ลาราชการ/ลาป่วย",    icon: "📋", gradient: G.pink,    text: "ลา" },
      { label: "เมนูทั้งหมด",  sub: "เปิดเมนูหลัก",         icon: "📋", gradient: G.indigo,  text: "เมนู" },
    ],
  },
  // ผู้อำนวยการ — ภาพรวมและการอนุมัติ + ประเมิน
  director: {
    name: "Smart School • Director",
    chatBarText: "🎖 เมนูผู้อำนวยการ",
    cells: [
      { label: "ภาพรวม",       sub: "สถิติโรงเรียน",        icon: "📊", gradient: G.violet,  text: "ภาพรวม" },
      { label: "ลาครู",         sub: "อนุมัติใบลา",          icon: "📋", gradient: G.rose,    text: "ลารออนุมัติ" },
      { label: "ข่าวรอเผยแพร่", sub: "อนุมัติข่าว",         icon: "📰", gradient: G.pink,    text: "ข่าวรอเผยแพร่" },
      { label: "ผู้ใช้",         sub: "สถิติผู้ใช้",           icon: "👥", gradient: G.sky,     text: "ผู้ใช้" },
      { label: "ประกาศ",        sub: "แจ้งฉุกเฉิน",           icon: "📣", gradient: G.amber,   text: "ประกาศ" },
      { label: "ปฏิทิน",        sub: "กิจกรรมโรงเรียน",     icon: "📅", gradient: G.teal,    text: "ปฏิทิน" },
      { label: "สรุปวันนี้",     sub: "ภาพรวมประจำวัน",     icon: "🗓", gradient: G.orange,  text: "สรุปวันนี้" },
      { label: "เมนูทั้งหมด",   sub: "เปิดเมนูหลัก",          icon: "📋", gradient: G.indigo,  text: "เมนู" },
    ],
  },
  // แอดมิน — เน้นดูแลระบบ ผู้ใช้ ประกาศ
  admin: {
    name: "Smart School • Admin",
    chatBarText: "🏫 เมนูแอดมิน",
    cells: [
      { label: "ภาพรวม",        sub: "สถิติวันนี้",           icon: "📊", gradient: G.violet,  text: "ภาพรวม" },
      { label: "ผู้ใช้",         sub: "สถิติผู้ใช้ในระบบ",     icon: "👥", gradient: G.sky,     text: "ผู้ใช้" },
      { label: "ลารออนุมัติ",    sub: "ใบลาครู",              icon: "📋", gradient: G.rose,    text: "ลารออนุมัติ" },
      { label: "ข่าวรอเผยแพร่",  sub: "อนุมัติข่าว",           icon: "📰", gradient: G.pink,    text: "ข่าวรอเผยแพร่" },
      { label: "ประกาศ",         sub: "Broadcast ระบบ",      icon: "📣", gradient: G.amber,   text: "ประกาศ" },
      { label: "ปฏิทิน",         sub: "กิจกรรมโรงเรียน",     icon: "📅", gradient: G.teal,    text: "ปฏิทิน" },
      { label: "ติดต่อ",         sub: "ข้อมูลโรงเรียน",       icon: "📞", gradient: G.emerald, text: "ติดต่อ" },
      { label: "เมนูทั้งหมด",    sub: "เปิดเมนูหลัก",          icon: "📋", gradient: G.indigo,  text: "เมนู" },
    ],
  },
  // ยังไม่เชื่อมบัญชี
  default: {
    name: "Smart School • Welcome",
    chatBarText: "✨ เริ่มต้นใช้งาน",
    cells: [
      { label: "เชื่อมบัญชี",  sub: "Link LINE ↔ ระบบ",     icon: "🔗", gradient: G.indigo,  text: "เชื่อม" },
      { label: "ข่าวสาร",       sub: "ประกาศโรงเรียน",       icon: "📰", gradient: G.pink,    text: "ข่าว" },
      { label: "ปฏิทิน",        sub: "กิจกรรม/วันหยุด",       icon: "📅", gradient: G.violet,  text: "ปฏิทิน" },
      { label: "ตารางเรียน",    sub: "ตารางวันนี้",           icon: "🗓", gradient: G.sky,     text: "ตารางสอน" },
      { label: "ติดต่อ",        sub: "โทร/แชทเจ้าหน้าที่",   icon: "📞", gradient: G.emerald, text: "ติดต่อ" },
      { label: "ฉุกเฉิน",       sub: "ประกาศฉุกเฉิน",         icon: "🚨", gradient: G.rose,    text: "ฉุกเฉิน" },
      { label: "ช่วยเหลือ",     sub: "คำถามที่พบบ่อย",         icon: "❓", gradient: G.amber,   text: "เมนู" },
      { label: "เมนูทั้งหมด",   sub: "เปิดเมนูหลัก",           icon: "📋", gradient: G.slate,   text: "เมนู" },
    ],
  },
};

function buildAreas(cells: Cell[]) {
  return cells.map((c, i) => ({
    bounds: {
      x: Math.round((i % COLS) * cellW),
      y: Math.round(Math.floor(i / COLS) * cellH),
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
  parent:   "Ultra-modern abstract gradient background for a Thai school parent app menu. Soft violet, indigo and emerald flowing gradients, subtle bokeh lights, smooth glassmorphism shapes, 3:2 wide composition, premium tech feel, no text, no logos.",
  teacher:  "Ultra-modern abstract gradient background for a Thai school teacher dashboard. Smooth emerald, sky blue and violet gradients with subtle geometric shapes and soft light flares, 3:2 wide composition, premium clean tech aesthetic, no text, no logos.",
  director: "Ultra-modern abstract gradient background for a Thai school principal/director dashboard. Elegant deep violet, gold amber and teal gradients with refined light rays and subtle geometric shapes, 3:2 wide composition, executive premium feel, no text, no logos.",
  admin:    "Ultra-modern abstract gradient background for a Thai school system admin dashboard. Deep violet, amber and rose gradients with subtle geometric shapes and refined light flares, 3:2 wide composition, executive premium feel, no text, no logos.",
  default:  "Ultra-modern welcoming abstract gradient background for a Thai school LINE official account. Indigo, pink and amber flowing gradients with soft bokeh and subtle stars, 3:2 wide composition, friendly premium feel, no text, no logos.",
};

async function generateBgPng(role: string): Promise<Uint8Array | null> {
  try {
    const img = await generateImage(BG_PROMPTS[role] || BG_PROMPTS.default, { size: "1536x1024" });
    return Uint8Array.from(atob(img.b64), (c) => c.charCodeAt(0));
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
    const x = (i % COLS) * cellW;
    const y = Math.floor(i / COLS) * cellH;
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
      <circle cx="${cx}" cy="${cy - 90}" r="95" fill="rgba(255,255,255,0.18)"/>
      <text x="${cx}" y="${cy - 70}" font-size="150" text-anchor="middle" dominant-baseline="middle">${c.icon}</text>
      <text x="${cx}" y="${cy + 110}" font-size="70" font-weight="800" fill="#FFFFFF" text-anchor="middle" font-family="'IBM Plex Sans Thai','Sarabun',sans-serif">${escapeXml(c.label)}</text>
      <text x="${cx}" y="${cy + 180}" font-size="42" font-weight="500" fill="rgba(255,255,255,0.82)" text-anchor="middle" font-family="'IBM Plex Sans Thai','Sarabun',sans-serif">${escapeXml(c.sub)}</text>
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

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function runSetup(force = false) {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tok } = await sb.from("school_settings").select("setting_value").eq("setting_key", "line_channel_access_token").maybeSingle();
  const token = tok?.setting_value;
  if (!token) throw new Error("LINE token not configured");

  await sb.from("school_settings").upsert(
    { setting_key: "line_richmenu_status", setting_value: JSON.stringify({ status: "processing", started_at: new Date().toISOString() }) },
    { onConflict: "setting_key" },
  );

  // Load current state (per-role): keep uploaded menus + dedup unchanged auto-svg
  const { data: stateRows } = await sb.from("line_richmenu_state").select("role, richmenu_id, content_hash, source");
  const state = new Map<string, { richmenu_id: string | null; content_hash: string; source: string }>();
  (stateRows || []).forEach((r: any) => state.set(r.role, r));

  const roles = ["default", "parent", "teacher", "director", "admin"] as const;
  // Compute new hash per role
  const nextHash = new Map<string, string>();
  for (const r of roles) {
    nextHash.set(r, await sha256Hex(`auto-svg:v2:${r}:${JSON.stringify(MENUS[r])}`));
  }

  // Keep-list: richmenu IDs that must not be deleted (uploaded menus + unchanged auto ones)
  const keep = new Set<string>();
  const ids: Record<string, string> = {};
  const skipped: string[] = [];
  for (const r of roles) {
    const cur = state.get(r);
    if (cur?.source === "upload" && cur.richmenu_id) {
      ids[r] = cur.richmenu_id;
      keep.add(cur.richmenu_id);
      skipped.push(`${r}(upload)`);
      continue;
    }
    if (!force && cur?.richmenu_id && cur.content_hash === nextHash.get(r) && cur.source === "auto-svg") {
      // Verify it still exists on LINE
      const chk = await lineFetch(token, `/richmenu/${cur.richmenu_id}`);
      if (chk.ok) {
        ids[r] = cur.richmenu_id;
        keep.add(cur.richmenu_id);
        skipped.push(`${r}(unchanged)`);
        continue;
      }
    }
  }

  // Wipe stale menus (not in keep)
  const listRes = await lineFetch(token, "/richmenu/list");
  if (listRes.ok) {
    const { richmenus } = await listRes.json();
    for (const rm of richmenus || []) {
      if (!keep.has(rm.richMenuId)) {
        await lineFetch(token, `/richmenu/${rm.richMenuId}`, { method: "DELETE" });
      }
    }
  }

  // Create missing roles
  for (const r of roles) {
    if (ids[r]) continue;
    ids[r] = await createMenu(token, r);
    await sb.from("line_richmenu_state").upsert({
      role: r,
      richmenu_id: ids[r],
      content_hash: nextHash.get(r)!,
      source: "auto-svg",
      image_path: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "role" });
  }

  await lineFetch(token, `/user/all/richmenu/${ids.default}`, { method: "POST" });

  for (const [role, id] of Object.entries(ids)) {
    await sb.from("school_settings").upsert(
      { setting_key: `line_richmenu_${role}`, setting_value: id },
      { onConflict: "setting_key" },
    );
  }

  await sb.from("school_settings").upsert(
    { setting_key: "line_richmenu_status", setting_value: JSON.stringify({ status: "completed", ids, skipped, completed_at: new Date().toISOString() }) },
    { onConflict: "setting_key" },
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let force = false;
    try { const body = await req.json(); force = !!body?.force; } catch { /* no body */ }
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(
      runSetup(force).catch(async (e) => {
        console.error("setup-line-richmenu bg error", e);
        try {
          const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          await sb.from("school_settings").upsert(
            { setting_key: "line_richmenu_status", setting_value: JSON.stringify({ status: "failed", error: e?.message || String(e), failed_at: new Date().toISOString() }) },
            { onConflict: "setting_key" },
          );
        } catch (_) { /* ignore */ }
      }),
    );

    return new Response(
      JSON.stringify({ ok: true, status: "processing", message: "กำลังสร้าง Rich Menu ในพื้นหลัง (ข้ามเมนูที่ไม่เปลี่ยน + คงรูปที่อัปโหลดเอง)" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("setup-line-richmenu error", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
