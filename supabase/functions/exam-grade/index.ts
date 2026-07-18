const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
import { aiCall } from "../_shared/aiCall.ts";

const SYS = `You are an OMR (optical mark recognition) engine for Thai school answer sheets.
You will be given a photo of an answer sheet that contains:
1. Anchor markers (black squares) at the 4 corners — use them to determine orientation
2. A student code area with N rows × 10 columns of filled bubbles (0-9 in each column), one digit per column
3. A list of question rows, each with bubbles A, B, C, D (and optionally E)

Detect which bubbles are filled (darkened). For each column of the student code, choose the digit whose bubble is most filled. For each question row, choose the answer letter whose bubble is most filled.

Respond ONLY in this JSON format:
{
  "student_code": "12345",
  "answers": { "1": "A", "2": "C", "3": null, ... }
}
Use null when no bubble (or multiple bubbles) is clearly marked.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { image_base64, question_count, student_code_digits } = await req.json();
    if (!image_base64) return j({ error: "image_base64 required" }, 400);

    const user = `Answer sheet specs:
- student_code_digits: ${student_code_digits || 5}
- questions: ${question_count || 20}
Detect the student code and the answer (A/B/C/D) for each question. Return JSON only.`;

    const imageUrl = image_base64.startsWith("data:")
      ? image_base64
      : `data:image/jpeg;base64,${image_base64}`;

    const result = await aiCall({
      vision: true,
      json: true,
      temperature: 0.1,
      functionName: "exam-grade",
      messages: [
        { role: "system", content: SYS },
        {
          role: "user",
          content: [
            { type: "text", text: user },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    let parsed: any = {};
    try { parsed = JSON.parse(result.content); } catch {
      const m = result.content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    return j({
      student_code: parsed.student_code || "",
      answers: parsed.answers || {},
      provider: result.provider,
    });
  } catch (e: any) {
    const msg = e?.message || "internal";
    if (msg.includes("429")) return j({ error: "ระบบ AI ใช้งานหนัก ลองใหม่อีกครั้ง" }, 429);
    if (msg.includes("402")) return j({ error: "เครดิต AI หมด — admin โปรดเพิ่ม provider ใหม่ที่ /dashboard/admin/ai-providers" }, 402);
    return j({ error: msg }, 500);
  }
});

function j(b: any, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
