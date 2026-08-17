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
    ? { v: ctx.bmi.value, cat: bmiCategory(ctx.bmi.value) }
    : null;

  // สรุป context ให้สั้นที่สุด — ลบ field ว่าง/null ทิ้ง เพื่อประหยัด input tokens
  const compact: Record<string, any> = {};
  if (ctx.name) compact.name = ctx.name;
  if (ctx.stats && Object.keys(ctx.stats).length) compact.stats = ctx.stats;
  if (ctx.nextEvent) compact.nextEvent = ctx.nextEvent;
  if (ctx.unread) compact.unread = ctx.unread;
  if (ctx.top) compact.top = ctx.top;
  if (ctx.low) compact.low = ctx.low;
  if (ctx.overall != null) compact.overall = ctx.overall;
  if (ctx.delta != null) compact.delta = ctx.delta;
  if (bmi) compact.bmi = bmi;
  if (Array.isArray(ctx.aiTopics) && ctx.aiTopics.length) compact.aiTopics = ctx.aiTopics.slice(0, 3);
  if (Array.isArray(ctx.subjectScores) && ctx.subjectScores.length) compact.subjectScores = ctx.subjectScores.slice(0, 5);

  const sys =
    `คุณคือมาสคอตโรงเรียน พูดกับ${ROLE_LABEL[role] || "ผู้ใช้"}แบบสั้น เป็นมิตร โฟกัส: ${ROLE_FOCUS[role] || "การใช้ระบบ"}\n` +
    `กติกา:\n` +
    `- ใช้เฉพาะตัวเลข/ข้อมูลที่อยู่ใน JSON บริบทเท่านั้น ห้ามแต่งเอง\n` +
    `- ห้ามพูดเรื่องงบ/การเงิน/อากาศ/ทักทาย/ชื่อผู้ใช้ซ้ำ\n` +
    `- ห้ามคำทั่วไป ("สู้ๆ" "ขยันนะ")\n` +
    `- ผลิต 4-6 ข้อ เท่าที่บริบทรองรับ แต่ละข้อ ≤ 80 ตัวอักษร อิโมจิ ≤1 ต่อข้อ ไม่ซ้ำหัวข้อ\n` +
    `- ตอบ JSON: {"messages":["...","..."]}`;

  const user = `role:${role}\nctx:${JSON.stringify(compact)}`;

  const res = await aiCall({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    json: true,
    temperature: 0.8,
    max_tokens: 600,
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
  const ctxStr = JSON.stringify(compact);
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
