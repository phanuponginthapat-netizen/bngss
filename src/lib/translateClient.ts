// ตัวเรียกบริการแปลภาษาแบบทนทาน (ไม่พึ่ง supabase.functions.invoke ที่มักโยน
// "Failed to send a request to the Edge Function" เมื่อเน็ตสะดุด/preflight พลาด)
import { supabase, SUPABASE_RUNTIME_URL, SUPABASE_RUNTIME_ANON_KEY } from "@/integrations/supabase/client";

export interface TranslatePayload {
  translation?: string;
  translations?: string[];
  fallback?: boolean;
  code?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function edgeTranslate(body: Record<string, unknown>): Promise<TranslatePayload> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token || SUPABASE_RUNTIME_ANON_KEY;
  const url = `${SUPABASE_RUNTIME_URL}/functions/v1/translate-text`;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_RUNTIME_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.status === 401) {
        const err: any = new Error("กรุณาเข้าสู่ระบบใหม่ก่อนใช้งานการแปล");
        err.code = "UNAUTHORIZED";
        throw err;
      }
      const text = await res.text();
      let payload: TranslatePayload = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = {};
      }
      if (!res.ok) {
        const err: any = new Error(payload.error || `บริการแปลตอบกลับผิดพลาด (HTTP ${res.status})`);
        err.code = payload.code || `HTTP_${res.status}`;
        throw err;
      }
      return payload;
    } catch (e: any) {
      lastErr = e;
      // 401 / error จาก server → ไม่ต้อง retry
      if (e?.code && e.code !== "NETWORK") break;
      if (e?.name === "AbortError" || e instanceof TypeError) {
        if (attempt < 2) {
          await sleep(400 * (attempt + 1));
          continue;
        }
      } else {
        break;
      }
    }
  }
  const err: any = lastErr instanceof Error ? lastErr : new Error("เชื่อมต่อบริการแปลไม่สำเร็จ");
  if (err instanceof TypeError || err?.name === "AbortError") {
    err.code = "NETWORK";
    err.message = "เชื่อมต่อบริการแปลไม่ได้ (เครือข่ายขัดข้อง) — ลองใหม่อีกครั้ง";
  }
  throw err;
}

/** สำรอง: แปลผ่านบริการสาธารณะฝั่งเบราว์เซอร์ เมื่อ Edge Function ใช้ไม่ได้ */
async function publicTranslate(texts: string[], target: string): Promise<string[] | null> {
  try {
    const out: string[] = [];
    for (const t of texts) {
      const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
        encodeURIComponent(target) +
        "&dt=t&q=" +
        encodeURIComponent(t);
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const joined = Array.isArray(json?.[0])
        ? json[0].map((seg: any[]) => seg?.[0] ?? "").join("")
        : "";
      if (!joined) return null;
      out.push(joined);
    }
    return out;
  } catch {
    return null;
  }
}

/** แปลข้อความเดียว */
export async function translateText(text: string, target: string): Promise<string> {
  try {
    const payload = await edgeTranslate({ text, target });
    if (!payload.fallback && payload.translation) return payload.translation;
    const alt = await publicTranslate([text], target);
    if (alt?.[0]) return alt[0];
    const err: any = new Error(payload.error || "แปลไม่สำเร็จ");
    err.code = payload.code;
    throw err;
  } catch (e) {
    const alt = await publicTranslate([text], target);
    if (alt?.[0]) return alt[0];
    throw e;
  }
}

/** แปลหลายข้อความพร้อมกัน (ใช้กับการแปลทั้งหน้า) */
export async function translateBatch(texts: string[], target: string): Promise<string[]> {
  try {
    const payload = await edgeTranslate({ texts, target });
    const list = Array.isArray(payload.translations) ? payload.translations : [];
    if (!payload.fallback && list.length === texts.length) return list;
    const alt = await publicTranslate(texts, target);
    if (alt && alt.length === texts.length) return alt;
    const err: any = new Error(payload.error || "แปลไม่สำเร็จ");
    err.code = payload.code || "SERVICE_UNAVAILABLE";
    throw err;
  } catch (e) {
    const alt = await publicTranslate(texts, target);
    if (alt && alt.length === texts.length) return alt;
    throw e;
  }
}
