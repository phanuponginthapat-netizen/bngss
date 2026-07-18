import { isAuthorizedUserOrCron, unauthorized } from "../_shared/cronAuth.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
import { aiCall } from "../_shared/aiCall.ts";

interface Body {
  weight_kg: number;
  height_cm: number;
  age?: number | null;
  gender?: string | null;
  history?: Array<{ date: string; weight_kg?: number | null; height_cm?: number | null; bmi?: number | null }>;
}

function calcAge(dob?: string | null): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const diff = Date.now() - b.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function categorize(bmi: number): string {
  if (bmi < 18.5) return "ต่ำกว่าเกณฑ์ (ผอม)";
  if (bmi < 23) return "ตรงเกณฑ์ (ปกติ)";
  if (bmi < 25) return "ท้วม";
  if (bmi < 30) return "เกินเกณฑ์ (อ้วน)";
  return "อ้วนมาก";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await isAuthorizedUserOrCron(req))) return unauthorized();

  try {
    const body: Body = await req.json();
    const w = Number(body.weight_kg);
    const h = Number(body.height_cm);
    if (!w || !h || h <= 0) {
      return new Response(JSON.stringify({ error: "weight_kg and height_cm required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const hm = h / 100;
    const bmi = +(w / (hm * hm)).toFixed(2);
    const category = categorize(bmi);
    const age = typeof body.age === "number" ? body.age : null;

    const trendText = (body.history || [])
      .slice(-6)
      .map((r) => `- ${r.date}: น้ำหนัก ${r.weight_kg ?? "-"} kg, ส่วนสูง ${r.height_cm ?? "-"} cm, BMI ${r.bmi ?? "-"}`)
      .join("\n");

    const prompt = `ข้อมูลนักเรียน:\n- เพศ: ${body.gender || "ไม่ระบุ"}\n- อายุ: ${age ?? "ไม่ระบุ"} ปี\n- น้ำหนัก: ${w} kg\n- ส่วนสูง: ${h} cm\n- BMI: ${bmi} (${category})\n${trendText ? `\nประวัติการชั่งล่าสุด:\n${trendText}` : ""}\n\nกรุณาประเมิน BMI ตามเกณฑ์กรมอนามัย (สำหรับเด็กวัยเรียน 6-18 ปีให้พิจารณาเพศ+อายุประกอบ) ตอบสั้น กระชับ เป็นภาษาไทย แบ่งเป็น:\n1) สรุปสถานะ (ตรงเกณฑ์ / เกินเกณฑ์ / น้อยกว่าเกณฑ์)\n2) ความเสี่ยงด้านสุขภาพ (1-2 ข้อ)\n3) คำแนะนำเชิงปฏิบัติ (3 ข้อ)`;

    const result = await aiCall({
      messages: [
        { role: "system", content: "คุณเป็นพยาบาลโรงเรียนที่ให้คำแนะนำสุขภาพเด็กไทย พูดเข้าใจง่าย ไม่วินิจฉัยโรค" },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 600,
      functionName: "assess-bmi",
    });

    return new Response(
      JSON.stringify({ bmi, category, assessment: result.content, model: result.model }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
