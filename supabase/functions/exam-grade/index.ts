import { corsHeaders } from "../_shared/cors.ts";
import { aiCall } from "../_shared/aiCall.ts";

const VALID_LETTERS = ["A", "B", "C", "D"];
const CHOICE_FORMATS: Record<string, string[]> = {
  abcd: ["A", "B", "C", "D"],
  "1234": ["1", "2", "3", "4"],
  thai: ["ก", "ข", "ค", "ง"],
};

const SYS = `You are an OMR (optical mark recognition) engine for Thai school answer sheets.
You will be given a photo of an answer sheet that contains:
1. Anchor markers (black squares) at the 4 corners — the top-left marker has an extra black dot; use them to determine orientation
2. A student code area with exactly D columns of bubbles (digits 0-9 stacked in each column), one digit per column, filled top-to-bottom
3. A list of question rows, each with exactly 4 bubbles labelled with the letters/digits given by the user (read the exact label printed above each column — e.g. A,B,C,D or 1,2,3,4 or ก,ข,ค,ง; there are always exactly 4 columns and no other choice letters exist on this sheet)

Detection rules:
- A bubble is "filled" when it is clearly darkened/blackened compared to the others in the same row/column
- For each student-code column: choose the ONE digit whose bubble is darkest. If none or more than one is clearly filled, choose null for that digit.
- For each question row: first read the exact label printed at the top of each bubble column (A/B/C/D, or 1/2/3/4, or ก/ข/ค/ง), then choose the ONE label whose bubble is darkest. If none or more than one is clearly filled, choose null.
- If the photo is sideways or upside down, rotate it mentally using the corner markers before reading.
- The number of question rows must exactly match the expected count given in the request. Do not invent extra questions.
- The number of student-code columns must exactly match the given student_code_digits. Do not invent more digits.
- IMPORTANT: return the bubble labels EXACTLY as printed on the sheet (the same alphabet given in the request). Do not convert labels to a different alphabet.

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "student_code": "12345",
  "answers": { "1": "A", "2": "C", "3": null, ... },
  "confidence": 0.0 to 1.0 overall
}
Use null when no bubble (or multiple bubbles) is clearly marked. Do not emit any label that is not in the given alphabet.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { image_base64, question_count, student_code_digits, choice_format } = await req.json();
    if (!image_base64) return j({ error: "image_base64 required" }, 400);

    const digits = Math.max(1, Math.min(10, Number(student_code_digits) || 5));
    const qCount = Math.max(1, Math.min(300, Number(question_count) || 20));
    const labels = CHOICE_FORMATS[choice_format] || CHOICE_FORMATS.abcd;
    const labelList = labels.join(", ");

    const user = `Answer sheet specs:
- student_code_digits: ${digits} (exactly this many columns)
- questions: ${qCount} (exactly this many question rows)
- choice labels printed above the bubble columns: ${labelList} (exactly these ${labels.length} labels, in this order)
Detect the student code and the answer for each question using the printed labels (${labelList}). Return JSON only.`;

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

    // === Output validation: normalize + sanitize before returning ===
    // answers must be object keyed by question number; values are the printed
    // labels (A/B/C/D, 1/2/3/4 or ก/ข/ค/ง) — map back to canonical A-D by index
    const rawAnswers = parsed.answers;
    const answers: Record<string, string | null> = {};
    if (rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)) {
      for (const [k, v] of Object.entries(rawAnswers)) {
        const raw = String(v ?? "").trim();
        const idx = labels.indexOf(raw);
        if (idx < 0) {
          // fallback: tolerate ASCII A-D even if sheet used a different alphabet
          const up = raw.toUpperCase();
          if (VALID_LETTERS.includes(up)) {
            const qno = Number(String(k).replace(/[^0-9]/g, ""));
            if (Number.isFinite(qno) && qno >= 1 && qno <= qCount) answers[String(qno)] = up;
          }
          continue;
        }
        const letter = VALID_LETTERS[idx];
        const qno = Number(String(k).replace(/[^0-9]/g, ""));
        if (Number.isFinite(qno) && qno >= 1 && qno <= qCount) answers[String(qno)] = letter;
      }
    }

    // student_code: keep only digits, exactly `digits` long (pad or truncate)
    const rawCode = String(parsed.student_code ?? "").replace(/[^0-9]/g, "");
    const student_code = (rawCode || "").padStart(digits, "0").slice(-digits);

    const confidence = typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : null;

    return j({
      student_code,
      answers,
      confidence,
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