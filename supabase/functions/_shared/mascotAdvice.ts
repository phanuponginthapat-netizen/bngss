// Shared mascot advice generator — ใช้ทั้ง `mascot-advice` (on-demand) และ
// `refresh-mascot-advice-weekly` (cron batch) เพื่อไม่ให้ Deno.serve ซ้อนกัน
import { aiCall } from "./aiCall.ts";

const ROLE_LABEL: Record<string, string> = {
  admin: "ผู้ดูแลระบบโรงเรียน",
  director: "ผู้อำนวยการโรงเรียน",
  teacher: "ครู",
  student: "นักเรียน",
  parent: "ผู้ปกครอง",
  alumni: "ศิษย์เก่า",
};

const ROLE_FOCUS: Record<string, string> = {
  admin: "ภาพรวมระบบโรงเรียน การมาเรียน บุคลากร ความเรียบร้อย (พูดเรื่องงบ/การเงินได้เฉพาะเมื่อ context มีตัวเลขจริงเท่านั้น)",
  director: "การบริหาร นโยบาย ผลสัมฤทธิ์ การติดตามครู/นักเรียน",
  teacher: "ห้องเรียนที่รับผิดชอบ เช็คชื่อ คะแนน การสอน แผนการสอน นักเรียนที่ควรดูแล",
  student: "การเรียน คะแนนตัวเอง การบ้าน เข้าเรียนตรงเวลา จุดแข็ง/ต้องพัฒนา สุขภาพ",
  parent: "ลูกของท่าน การเข้าเรียน พฤติกรรม การลา สุขภาพ การติดต่อครู",
  alumni: "ข่าวสารโรงเรียน กิจกรรมศิษย์เก่า การอัปเดตโปรไฟล์",
};

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "น้ำหนักน้อย (Underweight)";
  if (bmi < 23) return "ปกติ (Normal)";
  if (bmi < 25) return "ท้วม (Overweight)";
  if (bmi < 30) return "อ้วน (Obese I)";
  return "อ้วนมาก (Obese II)";
}

export async function generateMascotMessages(ctx: any, role: string): Promise<string[]> {
  const bmi = ctx.bmi && typeof ctx.bmi.value === "number"
    ? { ...ctx.bmi, category: bmiCategory(ctx.bmi.value) }
    : null;

  const inner = {
    name: ctx.name || "",
    stats: ctx.stats || null,
    weather: ctx.weather || null,
    nextEvent: ctx.nextEvent || null,
    unread: ctx.unread || 0,
    top: ctx.top || null,
    low: ctx.low || null,
    overall: ctx.overall ?? null,
    delta: ctx.delta ?? null,
    bmi,
    aiTopics: Array.isArray(ctx.aiTopics) ? ctx.aiTopics.slice(0, 5) : null,
    subjectScores: Array.isArray(ctx.subjectScores) ? ctx.subjectScores.slice(0, 8) : null,
  };

  const sys =
    `คุณคือ "มาสคอตโรงเรียน" พูดกับ${ROLE_LABEL[role] || "ผู้ใช้"}อย่างเป็นมิตร น่ารัก สั้น กระชับ ` +
    `โฟกัส: ${ROLE_FOCUS[role] || "การใช้ระบบ"} ` +
    `\n\n⛔ ห้ามทำเด็ดขาด:\n` +
    `- 🚨 ห้ามแต่งตัวเลข/เปอร์เซ็นต์/จำนวนเงิน/สถิติเองโดยเด็ดขาด — ใช้ได้เฉพาะตัวเลขที่ปรากฏใน "บริบท (JSON)" ด้านล่างเท่านั้น ถ้าไม่มีตัวเลขจริงในบริบท ห้ามพูดถึงตัวเลขเลย\n` +
    `- 🚨 ห้ามพูดเรื่อง "งบประมาณ" "ค่าใช้จ่าย" "การเงิน" ถ้าใน JSON ไม่มี field budget/finance — เพราะระบบยังไม่มีข้อมูลนั้น จะเป็นการโกหกผู้ใช้\n` +
    `- ห้ามพูดถึงหัวข้อที่ไม่มีข้อมูลใน context (เช่นไม่มี nextEvent ห้ามแต่งนัดหมาย, ไม่มี bmi ห้ามแต่ง BMI)\n` +
    `- ห้ามทักทาย — ผู้ใช้เห็นทุกวันแล้ว เบื่อ\n` +
    `- ห้ามพูดเรื่องพยากรณ์อากาศ/ฝน/แดด ถ้ามีวิดเจ็ตอากาศแยกอยู่แล้ว\n` +
    `- ห้ามขึ้นต้นด้วยชื่อผู้ใช้ทุกข้อ (พูดชื่อได้แค่ครั้งเดียวเท่านั้น)\n` +
    `- ห้ามพูดสิ่งทั่วไป เช่น "ขยันเรียนนะ" "สู้ ๆ" — ต้องมีเนื้อหา\n` +
    `- ห้ามซ้ำหัวข้อเดิม ทุกข้อความต้องเป็นคนละเรื่อง\n` +
    `\n✅ ภารกิจ: ผลิตข้อความ 4-8 ข้อ (เท่าที่บริบทมีข้อมูลรองรับจริง — ถ้าข้อมูลน้อยก็ทำน้อยข้อ ไม่ต้องฝืนเติม) เน้น "เนื้อหามีประโยชน์จริง":\n` +
    `1) เกร็ดความรู้/เคล็ดลับเฉพาะ — ถ้ามี aiTopics ให้ต่อยอด\n` +
    `2) BMI: ถ้ามี ให้บอก category + วิธีปรับเป็นรูปธรรม\n` +
    `3) คะแนน: ถ้า low ให้เทคนิคพัฒนา; ถ้า top ให้ชมเจาะจง\n` +
    `4) นัดหมาย/unread ถ้ามี\n` +
    `5) สถิติน่าสนใจจาก stats (ใช้ตัวเลขจริงเท่านั้น)\n` +
    `\nกติกา: ภาษาไทย อิโมจิเล็กน้อย (≤1/ข้อ) แต่ละข้อ ≤ 90 ตัวอักษร ` +
    `ตอบเป็น JSON: {"messages": ["...", "..."]}`;

  const user =
    `บทบาท: ${role}\n` +
    `ชื่อผู้ใช้: ${inner.name || "(ไม่ทราบ)"}\n` +
    `บริบท (JSON): ${JSON.stringify(inner)}\n\n` +
    `สร้างข้อความ 6-10 ข้อสำหรับหมุนเวียนใช้ทั้งสัปดาห์`;

  const res = await aiCall({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    json: true,
    temperature: 0.85,
    max_tokens: 1400,
    functionName: "mascot-advice",
  });

  let messages: string[] = [];
  const raw = (res.content || "").trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.messages)) {
      messages = parsed.messages.filter((m: any) => typeof m === "string" && m.trim());
    }
  } catch {
    // JSON truncated/invalid — ดึงเฉพาะ string ที่อยู่ใน array ของ "messages"
    const arrStart = raw.indexOf("[");
    const body = arrStart >= 0 ? raw.slice(arrStart) : raw;
    const matches = body.match(/"((?:[^"\\]|\\.)*)"/g) || [];
    messages = matches
      .map((s) => {
        try { return JSON.parse(s) as string; } catch { return ""; }
      })
      .filter((s) => s && s.length > 5 && s !== "messages");
  }


  const BAD = [
    /^(สวัสดี|หวัดดี|hello|hi|hey|ไง)/i,
    /(พยากรณ์|อากาศ|ฝนตก|แดดออก|อุณหภูมิ|ร้อนจัด|หนาว|พายุ)/i,
    /^(สู้\s*ๆ?|ขยันนะ|ขยันเรียน|วันนี้เป็นวันดี|มีความสุข)[!\.\s]*$/i,
  ];

  // 🚨 รวบรวมตัวเลขทุกตัวที่อยู่ในบริบทจริง — ใช้ตรวจว่า AI แต่งตัวเลขเองหรือไม่
  const ctxStr = JSON.stringify(inner);
  const ctxNumbers = new Set<string>((ctxStr.match(/\d+(?:\.\d+)?/g) || []));
  const SAFE_SMALL = new Set(["0", "1", "2", "3", "4", "5", "10", "100"]); // เลขนับทั่วไป

  // ตรวจว่าใน context มีฟิลด์เกี่ยวกับการเงิน/งบประมาณจริงไหม
  const hasFinanceCtx = /\b(budget|finance|expense|spend|cost|งบ)\b/i.test(ctxStr);
  const FINANCE_TOPIC = /(งบประมาณ|งบเดือน|งบปี|ค่าใช้จ่าย|รายจ่าย|รายรับ|การเงิน|เงินเดือน|จัดซื้อ|สั่งซื้อ|อุปกรณ์เรียน)/;

  return messages
    .filter((m) => !BAD.some((re) => re.test(m)))
    .filter((m) => {
      // ถ้าไม่มี context การเงิน → ตัดข้อความเรื่องเงิน/งบทิ้ง
      if (!hasFinanceCtx && FINANCE_TOPIC.test(m)) return false;
      // ถ้ามีเปอร์เซ็นต์/ตัวเลขในข้อความ ต้องเป็นตัวเลขที่อยู่ใน context จริงเท่านั้น
      const nums = m.match(/\d+(?:\.\d+)?/g) || [];
      for (const n of nums) {
        if (SAFE_SMALL.has(n)) continue;
        if (!ctxNumbers.has(n)) return false; // AI แต่งตัวเลขเอง → ทิ้ง
      }
      return true;
    })
    .slice(0, 10);
}
