const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
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
    const totalCount = Math.max(1, Math.min(200, Number(count) || 10));

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

    // Chunk large requests to avoid token limits & partial responses.
    const CHUNK = 10;
    const all: any[] = [];
    let lastProvider = "";
    let startNo = 1;
    let attempts = 0;
    const MAX_ATTEMPTS = Math.ceil(totalCount / CHUNK) + 3;

    while (all.length < totalCount && attempts < MAX_ATTEMPTS) {
      attempts++;
      const remaining = totalCount - all.length;
      const batchSize = Math.min(CHUNK, remaining);

      const prompt = `วิชา: ${subject || "-"}
หัวข้อ/เนื้อหา: ${topic || "-"}
ระดับชั้น: ${grade_level || "-"}
ระดับความยาก: ${level || "medium"}
จำนวนข้อในชุดนี้: ${batchSize} (ชุดที่ ${attempts} จากทั้งหมด ${totalCount} ข้อ — เริ่มลำดับข้อที่ ${startNo})
อ้างอิงแนวข้อสอบ: ${refs}

ตัวชี้วัด/มาตรฐานการเรียนรู้ที่ต้องใช้ในการออกข้อสอบ:
${indicatorBlock}

โปรดออกข้อสอบให้ครบ ${batchSize} ข้อในการตอบครั้งนี้ (ห้ามน้อยกว่า):
- เริ่มเลข question_no ที่ ${startNo}
- ห้ามซ้ำเนื้อหากับข้อก่อนหน้า พยายามให้เนื้อหา/สถานการณ์แตกต่างกัน
- ทุกข้อระบุ indicator_code และ indicator_description
- กระจายตัวชี้วัดให้ครอบคลุม
- correct_index = ตำแหน่งคำตอบถูกใน choices (0-3)
- ⚠️ ห้ามเขียน "A และ C" หรือ "ข้อ 1 และ 3" ในเนื้อหา choices/explanation — ให้เขียนเนื้อหาเต็มๆ เพราะตัวเลือกจะถูกสุ่มสลับ`;

      const result = await aiCall({
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: prompt },
        ],
        temperature: 0.85,
        max_tokens: 8000,
        json: true,
        functionName: "exam-generate",
      });
      lastProvider = result.provider;

      let parsed: any = {};
      try { parsed = JSON.parse(result.content); } catch {
        const m = result.content.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = {}; } }
      }

      const raw: any[] = Array.isArray(parsed.questions) ? parsed.questions : [];
      if (raw.length === 0) {
        // avoid infinite loop if the model returns nothing usable
        if (attempts >= 2 && all.length === 0) break;
        continue;
      }

      for (const q of raw) {
        if (all.length >= totalCount) break;
        const choices = Array.isArray(q.choices) ? q.choices.slice(0, 4) : [];
        if (choices.length < 2) continue;
        const origIdx = q.correct_index !== undefined
          ? letterToIndex(q.correct_index)
          : letterToIndex(q.correct_answer);
        const { choices: shuffled, correctIdx } = shuffleChoices(choices, origIdx);
        all.push({
          ...q,
          question_no: all.length + 1,
          choices: shuffled,
          correct_answer: LETTERS[correctIdx] || "A",
          correct_index: correctIdx,
        });
      }
      startNo = all.length + 1;
    }

    return j({
      questions: all,
      requested: totalCount,
      generated: all.length,
      provider: lastProvider,
    });
  } catch (e: any) {
    return j({ error: e?.message || "internal" }, 500);
  }
});

function j(b: any, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
