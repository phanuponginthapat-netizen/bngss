// Suggest mapping of proxy subjects (T-*) to curriculum subjects using Lovable AI
// Input: { proxies: [{id, code, name_th, grade_level}], real: [{id, code, name_th, grade_level}] }
// Output: { suggestions: { [proxyId]: realId | null } }
import { aiCall } from "../_shared/aiCall.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { proxies, real } = await req.json();
    if (!Array.isArray(proxies) || !Array.isArray(real)) {
      return new Response(JSON.stringify({ error: "invalid input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const prompt = `คุณเป็นผู้ช่วยจับคู่ "วิชา proxy" (ที่สร้างจากชื่อครู) เข้ากับ "วิชาในหลักสูตร" ของโรงเรียนไทย
กฎ:
- จับคู่เฉพาะวิชาที่อยู่ระดับชั้นเดียวกัน (grade_level เหมือนกัน) เท่านั้น
- ถ้าไม่มีข้อมูลพอที่จะมั่นใจ ให้ตอบ null
- ใช้ชื่อครู (อยู่ในชื่อ proxy "วิชาของครู<ชื่อ>") เป็นเบาะแสว่าครูคนนั้นน่าจะสอนวิชาอะไร ถ้าไม่รู้ ให้ null
- ตอบเป็น JSON อย่างเดียว ห้ามอธิบาย

PROXY:
${JSON.stringify(proxies)}

CURRICULUM:
${JSON.stringify(real)}

ตอบในรูปแบบ: {"suggestions": {"<proxyId>": "<realId or null>"}}`;

    const result = await aiCall({
      messages: [{ role: "user", content: prompt }],
      json: true,
      temperature: 0.2,
      functionName: "suggest-proxy-mapping",
    });
    const content = result.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const suggestions: Record<string, string | null> = parsed.suggestions || {};

    // Validate: ensure ids exist and grade matches
    const realById = new Map(real.map((r: any) => [r.id, r]));
    const proxyById = new Map(proxies.map((p: any) => [p.id, p]));
    const clean: Record<string, string | null> = {};
    for (const p of proxies) {
      const v = suggestions[p.id];
      if (v && realById.has(v)) {
        const r = realById.get(v);
        if (!p.grade_level || !r.grade_level || r.grade_level === p.grade_level) {
          clean[p.id] = v;
          continue;
        }
      }
      clean[p.id] = null;
    }
    return new Response(JSON.stringify({ suggestions: clean }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
