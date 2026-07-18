// Web grounding via Gemini Google Search tool.
// คืน snippet + รายการ source URL เพื่อให้ AI หลักใช้อ้างอิงเป็นข้อเท็จจริง
// (ไม่ block flow — ถ้าพลาดก็คืน "" ให้ flow หลักเดินต่อ)

import { getSecret } from "./getSecret.ts";
import { secretKeys } from "./secretKeys.ts";

export type GroundedFacts = {
  text: string;          // สรุปข้อเท็จจริงจากการค้น (อาจเป็น "")
  sources: string[];     // URL อ้างอิง
};

/** ตรวจว่าคำถามน่าจะเป็น "ข้อเท็จจริงที่ต้องค้นเว็บ" หรือไม่ */
export function shouldGround(text: string): boolean {
  const t = (text || "").toLowerCase().trim();
  if (!t || t.length < 3) return false;
  // ข้อความที่ "ไม่ต้อง" ground: ทักทาย, ระบบ/วิธีใช้แอป, ขอบคุณ, ความรู้สึก
  const skip = /^(สวัสดี|hi\b|hello|hey|ขอบคุณ|thanks|thank you|โอเค|ok\b|ครับ|ค่ะ|👍|❤️)/i;
  if (skip.test(t)) return false;
  if (/ระบบ|วิธีใช้|login|เข้าระบบ|รหัสผ่าน|app|แอป|ปุ่ม|เมนู|setting|ตั้งค่า/i.test(t)) return false;
  // นอกนั้น ground ทุกอย่าง — ให้ AI ตอบจากข้อเท็จจริงจากเว็บเสมอ
  return true;
}

/** เรียก Gemini พร้อม Google Search tool — คืน text + sources */
export async function groundWithGemini(query: string, opts?: { lang?: "th" | "en" }): Promise<GroundedFacts> {
  const key = await getSecret(secretKeys.gemini);
  if (!key) return { text: "", sources: [] };
  const lang = opts?.lang === "en" ? "English" : "Thai";
  const prompt = `ค้นเว็บเพื่อรวบรวมข้อเท็จจริงล่าสุดที่เกี่ยวข้องกับคำถามนี้ ตอบเป็น ${lang} เท่านั้น
- สรุปเฉพาะข้อเท็จจริงที่ตรวจสอบได้จากแหล่งที่น่าเชื่อถือ (เว็บราชการ องค์กรการศึกษา สำนักข่าวหลัก สารานุกรม)
- ห้ามเดา ห้ามใส่ความคิดเห็น ห้ามใส่คำแนะนำ
- ถ้าไม่พบข้อมูลที่ชัดเจน ให้ตอบ "ไม่พบข้อมูลที่ยืนยันได้"
- ความยาวไม่เกิน 8 บูลเล็ตสั้นๆ
คำถาม: ${query}`;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
      }),
    });
    if (!r.ok) return { text: "", sources: [] };
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("\n").trim() || "";
    const grounding = data?.candidates?.[0]?.groundingMetadata;
    const chunks = grounding?.groundingChunks || [];
    const sources: string[] = [];
    for (const c of chunks) {
      const u = c?.web?.uri;
      if (u && !sources.includes(u)) sources.push(u);
      if (sources.length >= 5) break;
    }
    return { text, sources };
  } catch {
    return { text: "", sources: [] };
  }
}
