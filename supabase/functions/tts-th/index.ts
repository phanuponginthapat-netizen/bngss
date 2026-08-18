// Thai TTS via Google Translate (free, no API key, no credits)
// Hard limit 200 chars/request → chunk ที่ ~180 chars แบบ sentence-aware
// รองรับทั้ง POST (JSON) และ GET ?text=... (ให้ <audio src> ใช้ตรงๆ บน Chromium/Linux)
import { buildCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = buildCorsHeaders([], "GET, POST, OPTIONS");


const MAX_CHUNK = 180;

function chunkText(text: string, max = MAX_CHUNK): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  const sentences = clean.split(/(?<=[.!?。！？\n])\s+|(?<=[ฯ])\s+/);
  let buf = "";
  const push = (s: string) => { if (s.trim()) out.push(s.trim()); };
  for (const s of sentences) {
    if (s.length > max) {
      if (buf) { push(buf); buf = ""; }
      // ตัดตามช่องว่างก่อน ถ้ายังยาวเกินค่อยตัดดิบ
      const words = s.split(" ");
      let acc = "";
      for (const w of words) {
        if (w.length > max) {
          if (acc) { push(acc); acc = ""; }
          for (let i = 0; i < w.length; i += max) push(w.slice(i, i + max));
        } else if ((acc + " " + w).trim().length > max) {
          push(acc); acc = w;
        } else {
          acc = acc ? acc + " " + w : w;
        }
      }
      if (acc) push(acc);
    } else if ((buf + " " + s).trim().length > max) {
      push(buf); buf = s;
    } else {
      buf = buf ? buf + " " + s : s;
    }
  }
  if (buf) push(buf);
  return out;
}

async function fetchChunk(text: string, lang: string): Promise<Uint8Array | null> {
  const url =
    `https://translate.google.com/translate_tts?ie=UTF-8` +
    `&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://translate.google.com/",
        "Accept": "*/*",
      },
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("audio") && !ct.includes("mpeg")) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    return buf.length > 200 ? buf : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { text, lang } = await req.json().catch(() => ({}));
    const input = String(text || "").slice(0, 3000).trim();
    if (!input) {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tl = String(lang || "th");
    const chunks = chunkText(input);
    const parts: Uint8Array[] = [];
    for (const c of chunks) {
      const buf = await fetchChunk(c, tl);
      if (buf) parts.push(buf);
    }
    if (parts.length === 0) {
      return new Response(JSON.stringify({ fallback: true, error: "google tts failed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { out.set(p, off); off += p.length; }
    return new Response(out, {
      headers: {
        ...corsHeaders,
        // supabase.functions.invoke() แปลงเป็น Blob เฉพาะ application/octet-stream/pdf
        // ถ้าส่ง audio/mpeg จะถูกอ่านเป็น text แล้วไฟล์ MP3 เสีย ทำให้ฝั่ง browser เงียบ
        "Content-Type": "application/octet-stream",
        "X-Audio-Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ fallback: true, error: e?.message || "tts error" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
