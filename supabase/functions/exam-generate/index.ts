import { corsHeaders } from "../_shared/cors.ts";
import { aiCall } from "../_shared/aiCall.ts";


const SYS = `คุณคือครูผู้เชี่ยวชาญในการออกข้อสอบมาตรฐานของไทย อ้างอิงหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551 (ฉบับปรับปรุง 2560) ของ สพฐ. และตัวชี้วัด/หลักสูตรของโรงเรียนที่ให้มา
ออกข้อสอบเป็นภาษาไทย ปรนัย 4 ตัวเลือก ตามจำนวนที่กำหนด

⚠️ กฎสำคัญเรื่องตัวเลือก (ห้ามทำผิด):
1. ห้ามอ้างอิงตัวเลือกอื่นด้วยตัวอักษร/ตัวเลข (เช่น "A และ C", "ข้อ 1 และ 3", "ถูกทั้งข้อ ก. และ ค.") — เพราะตัวเลือกจะถูกสุ่มสลับลำดับ ทำให้คำอ้างอิงผิดทันที
2. ถ้าต้องการให้คำตอบหมายถึง "ถูกทุกข้อ" ให้เขียนเต็มว่า "ถูกทุกข้อ" หรือ "ทุกข้อที่กล่าวมา"
3. ถ้าต้องการให้คำตอบหมายถึง "ผิดทุกข้อ" ให้เขียนว่า "ไม่มีข้อใดถูก"
4. ถ้าต้องการตัวเลือกแบบรวม ให้เขียนเนื้อหาของตัวเลือกนั้นๆ ออกมาตรงๆ เช่น "คลิกปุ่ม Start และเลือก All Programs" (ไม่ใช่ "ข้อ 1 และ 2")
5. แต่ละตัวเลือกต้องเป็นข้อความสมบูรณ์ยืนได้ด้วยตัวเอง ไม่พึ่งพาตัวเลือกอื่น

ตอบเป็น JSON เท่านั้น รูปแบบ:
{
  "questions": [
    {
      "question_no": 1,
      "question_text": "...",
      "choices": ["...","...","...","..."],
      "correct_index": 0,
      "explanation": "เฉลยละเอียด อธิบายเหตุผลที่ตอบถูก และเหตุผลที่ตัวเลือกอื่นผิด (ในเฉลยให้อ้างอิงด้วยเนื้อหาของตัวเลือก ไม่ใช่ตัวอักษร เพราะจะถูกสุ่มลำดับ)",
      "bloom_level": "remember|understand|apply|analyze|evaluate|create",
      "reference": "onet|nt|pisa",
      "indicator_code": "ตรงกับรหัสตัวชี้วัดที่ให้มา เช่น ค 1.1 ป.5/1",
      "indicator_description": "คำอธิบายตัวชี้วัด"
    }
  ]
}
หมายเหตุ: correct_index = ตำแหน่งของคำตอบที่ถูกใน choices (0-3) ระบบจะสุ่มสลับลำดับให้เอง`;

// Seeded shuffle (Fisher-Yates) — เพื่อให้ตัวเลือกกระจายไม่เรียงเป็นแถวเดียว
function shuffleChoices(choices: string[], correctIdx: number): { choices: string[]; correctIdx: number } {
  if (!Array.isArray(choices) || choices.length < 2) return { choices, correctIdx };
  const indexed = choices.map((c, i) => ({ c, orig: i }));
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  const newCorrect = indexed.findIndex((x) => x.orig === correctIdx);
  return { choices: indexed.map((x) => x.c), correctIdx: newCorrect >= 0 ? newCorrect : 0 };
}

// แปลง letter (A/B/C/D หรือ ก/ข/ค/ง หรือ 1/2/3/4) เป็น index 0-3
function letterToIndex(v: any): number {
  if (typeof v === "number") return Math.max(0, Math.min(3, v));
  const s = String(v || "").trim().toUpperCase();
  const map: Record<string, number> = {
    "A": 0, "B": 1, "C": 2, "D": 3,
    "ก": 0, "ข": 1, "ค": 2, "ง": 3,
    "1": 0, "2": 1, "3": 2, "4": 3,
  };
  return map[s] ?? 0;
}

const LETTERS = ["A", "B", "C", "D"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { subject, topic, level, count, references, grade_level, indicators } = await req.json();
    const refs = Array.isArray(references) && references.length ? references.join(", ") : "onet";

    // Clamp count to a sane, printable range (answer sheet fits ~128 per A4 page)
    const requested = Math.max(1, Math.min(200, Number(count) || 10));
    const requestedLabel = Number(count) || 10;

    const indicatorList: Array<{ code?: string; title: string; description?: string }> =
      Array.isArray(indicators) ? indicators : [];
    const indicatorBlock = indicatorList.length
      ? indicatorList
          .map((it, i) => {
            const code = it.code || it.title?.split(" ")[0] || `IND-${i + 1}`;
            const desc = it.description ? ` — ${it.description}` : "";
            return `- [${code}] ${it.title}${desc}`;
          })
          .join("\n")
      : "(ไม่มีตัวชี้วัดเฉพาะ — ให้ AI อ้างอิงตัวชี้วัดแกนกลาง สพฐ. ของวิชา/ระดับชั้นนี้แทน และระบุรหัสตัวชี้วัดมาตรฐาน)";

    const prompt = `วิชา: ${subject || "-"}
หัวข้อ/เนื้อหา: ${topic || "-"}
ระดับชั้น: ${grade_level || "-"}
ระดับความยาก: ${level || "medium"}
จำนวนข้อ: ${requestedLabel}
อ้างอิงแนวข้อสอบ: ${refs}

ตัวชี้วัด/มาตรฐานการเรียนรู้ที่ต้องใช้ในการออกข้อสอบ:
${indicatorBlock}

โปรดออกข้อสอบ ${requested} ข้อ:
- ทุกข้อระบุ indicator_code และ indicator_description
- กระจายตัวชี้วัดให้ครอบคลุม
- correct_index = ตำแหน่งคำตอบถูกใน choices (0-3)
- ⚠️ ห้ามเขียน "A และ C" หรือ "ข้อ 1 และ 3" ในเนื้อหา choices/explanation — ให้เขียนเนื้อหาเต็มๆ เพราะตัวเลือกจะถูกสุ่มสลับ
- ตำแหน่งคำตอบถูกในแต่ละข้อ ไม่ต้องพยายามกระจาย — ระบบจะสุ่มให้เอง`;

    const result = await aiCall({
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      json: true,
      functionName: "exam-generate",
    });

    let parsed: any = {};
    try { parsed = JSON.parse(result.content); } catch {
      const m = result.content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    // Post-process: shuffle choices + remap correct_answer ให้เป็น A/B/C/D
    const rawQuestions: any[] = Array.isArray(parsed.questions) ? parsed.questions : [];

    // Dedupe/normalize question_no (UNIQUE(exam_id, question_no) จะ fail ถ้าซ้ำ)
    const seen = new Set<number>();
    let fallbackNo = 1;
    const questions = rawQuestions.map((q) => {
      const rawNo = Number(q.question_no);
      let qno = Number.isFinite(rawNo) && rawNo >= 1 ? rawNo : fallbackNo;
      while (seen.has(qno)) qno = qno + 1;
      seen.add(qno);
      fallbackNo = Math.max(fallbackNo, qno + 1);

      // Choices: ต้องมีครบ 4 ตัว — ถ้าเกินตัด ถ้าไม่พอเติมข้อความว่าง (จะโดนแก้ภายหลังถ้ายังไม่ครบ)
      const choices = Array.isArray(q.choices)
        ? q.choices.map((c: any) => String(c ?? "").trim()).filter((c: string) => c.length > 0).slice(0, 4)
        : [];
      while (choices.length < 4) choices.push(`ตัวเลือกที่ ${choices.length + 1}`);

      // รับได้ทั้ง correct_index (ใหม่) และ correct_answer (เก่า)
      const origIdx = q.correct_index !== undefined
        ? letterToIndex(q.correct_index)
        : letterToIndex(q.correct_answer);
      const { choices: shuffled, correctIdx } = shuffleChoices(choices, origIdx);
      return {
        ...q,
        question_no: qno,
        choices: shuffled,
        correct_answer: LETTERS[correctIdx] || "A", // เก็บเป็น A/B/C/D เสมอ (index-based)
        correct_index: correctIdx,
      };
    });

    return j({ questions, provider: result.provider });
  } catch (e: any) {
    return j({ error: e?.message || "internal" }, 500);
  }
});

function j(b: any, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
