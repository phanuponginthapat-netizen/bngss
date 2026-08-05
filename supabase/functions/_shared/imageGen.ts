// Image generation — Standalone (ไม่ใช้ Lovable AI Gateway)
// ลำดับ: OpenAI Images → Google Gemini (generativelanguage) → error
import { getSecret } from "./getSecret.ts";
import { secretKeys } from "./secretKeys.ts";
import { lovableFallbackEnabled, NO_LOVABLE_AI_MSG } from "./standalone.ts";

export interface ImageResult {
  b64: string;
  provider: string;
}

export async function generateImage(prompt: string, opts?: { size?: string }): Promise<ImageResult> {
  const errors: string[] = [];

  // 1) OpenAI
  const openaiKey = await getSecret(secretKeys.openai);
  if (openaiKey) {
    try {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt,
          size: opts?.size ?? "1024x1024",
          n: 1,
        }),
      });
      const t = await r.text();
      if (r.ok) {
        const b64 = JSON.parse(t)?.data?.[0]?.b64_json;
        if (b64) return { b64, provider: "openai" };
        errors.push("openai: empty image");
      } else errors.push(`openai [${r.status}]: ${t.slice(0, 200)}`);
    } catch (e) {
      errors.push(`openai: ${String(e)}`);
    }
  }

  // 2) Google Gemini (native API key)
  const geminiKey = await getSecret(secretKeys.gemini);
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
      );
      const t = await r.text();
      if (r.ok) {
        const parts = JSON.parse(t)?.candidates?.[0]?.content?.parts ?? [];
        const inline = parts.find((p: any) => p?.inlineData?.data)?.inlineData?.data;
        if (inline) return { b64: inline, provider: "gemini" };
        errors.push("gemini: empty image");
      } else errors.push(`gemini [${r.status}]: ${t.slice(0, 200)}`);
    } catch (e) {
      errors.push(`gemini: ${String(e)}`);
    }
  }

  // 3) Lovable gateway — ปิดโดยค่าเริ่มต้น
  if (lovableFallbackEnabled()) {
    const lovKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovKey) {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovKey}` },
        body: JSON.stringify({ model: "google/gemini-2.5-flash-image", prompt, n: 1 }),
      });
      if (r.ok) {
        const b64 = (await r.json())?.data?.[0]?.b64_json;
        if (b64) return { b64, provider: "lovable" };
      }
      errors.push(`lovable [${r.status}]`);
    }
  }

  throw new Error(
    errors.length
      ? `สร้างรูปไม่สำเร็จ: ${errors.join(" | ").slice(0, 400)}`
      : `${NO_LOVABLE_AI_MSG} (ต้องมี OPENAI_API_KEY หรือ GEMINI_API_KEY สำหรับสร้างรูป)`,
  );
}
