import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiCall } from "../_shared/aiCall.ts";

import { corsHeaders } from "../_shared/cors.ts";

const PROMPT = `คุณคือผู้ช่วยดึงข้อมูลคะแนนสอบมาตรฐานของโรงเรียนไทย (O-NET / NT / RT / PISA)
จากเอกสาร/ภาพ/ข้อความ ให้ดึงเป็น JSON array ของรายการคะแนน — 1 รายการ ต่อ 1 (ปี + ประเภท + ระดับชั้น + วิชา)

แต่ละรายการมีฟิลด์:
- academic_year: ปีการศึกษา (พ.ศ.) เป็นตัวเลข เช่น 2566 (ถ้าเอกสารใช้ ค.ศ. ให้บวก 543)
- test_type: หนึ่งใน "onet" | "nt" | "rt" | "pisa" | "other"
- grade_level: ระดับชั้น เช่น "ป.3", "ป.6", "ม.3", "ม.6"
- subject: ชื่อวิชา เช่น "ภาษาไทย", "คณิตศาสตร์", "วิทยาศาสตร์", "ภาษาอังกฤษ", "ด้านภาษา", "ด้านคำนวณ", "ด้านเหตุผล", "การอ่าน", "คณิต PISA", "วิทยาศาสตร์ PISA"
- avg_score: คะแนนเฉลี่ยของโรงเรียน (ตัวเลข 0-100)
- student_count: จำนวนนักเรียนที่เข้าสอบ (ตัวเลข, ถ้าไม่ระบุให้ใส่ 0)
- national_avg: ค่าเฉลี่ยระดับประเทศ (ตัวเลข หรือ null ถ้าไม่มี)
- area_avg: ค่าเฉลี่ยระดับเขตพื้นที่/สังกัด (ตัวเลข หรือ null ถ้าไม่มี)
- notes: หมายเหตุสั้นๆ (เช่น "ปกศ. 2566") หรือ ""

กฎ:
- แปลงเลขไทย (๑๒๓) เป็นอาราบิก
- ถ้าเอกสารเป็น NT จะมี "ด้านภาษา/ด้านคำนวณ/ด้านเหตุผล" — ใช้เป็น subject และตั้ง grade_level เป็น "ป.3"
- RT (อ่านออกเขียนได้) มักเป็น ป.1 — ตั้ง grade_level เป็น "ป.1"
- O-NET ป.6 / ม.3 / ม.6 รายวิชาแยก
- ห้ามสร้างแถวซ้ำ ห้ามรวมแถว "เฉลี่ยรวม"
- ตอบเป็น JSON array เท่านั้น ไม่ต้องมี markdown`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await admin.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", callerId).in("role", ["admin", "director"]).maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { text, fileBase64, mimeType } = body as { text?: string; fileBase64?: string; mimeType?: string };

    if (!text && !fileBase64) {
      return new Response(JSON.stringify({ error: "ต้องส่ง text หรือ fileBase64 อย่างน้อยหนึ่งอย่าง" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [];
    if (fileBase64) {
      const mt = mimeType || "application/pdf";
      userContent.push({ type: "image_url", image_url: { url: `data:${mt};base64,${fileBase64}` } });
      userContent.push({ type: "text", text: PROMPT });
    } else {
      userContent.push({ type: "text", text: `${PROMPT}\n\nข้อความ:\n${(text || "").substring(0, 30000)}` });
    }

    let aiResult;
    try {
      aiResult = await aiCall({
        vision: !!fileBase64,
        json: false,
        temperature: 0.1,
        functionName: "ai-import-test-scores",
        userId: callerId,
        messages: [
          { role: "system", content: "You are a precise data extractor for Thai standardized test reports. Output JSON arrays only." },
          { role: "user", content: userContent },
        ],
      });
    } catch (err: any) {
      const msg = String(err?.message || err);
      const status = /429|rate limit/i.test(msg) ? 429 : /402|credit/i.test(msg) ? 402 : 500;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseText = aiResult.content || "[]";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : responseText;

    let rows: any[] = [];
    try {
      rows = JSON.parse(jsonStr);
    } catch {
      return new Response(JSON.stringify({ error: "AI ตอบกลับไม่ใช่ JSON ที่ถูกต้อง", raw: responseText.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize
    const ALLOWED = new Set(["onet", "nt", "rt", "pisa", "other"]);
    rows = (Array.isArray(rows) ? rows : []).map((r) => ({
      academic_year: Number(r.academic_year) || new Date().getFullYear() + 543,
      test_type: ALLOWED.has(String(r.test_type).toLowerCase()) ? String(r.test_type).toLowerCase() : "other",
      grade_level: String(r.grade_level || "ป.6"),
      subject: String(r.subject || "").trim(),
      avg_score: r.avg_score == null ? 0 : Number(r.avg_score),
      student_count: r.student_count == null ? 0 : Number(r.student_count),
      national_avg: r.national_avg == null || r.national_avg === "" ? null : Number(r.national_avg),
      area_avg: r.area_avg == null || r.area_avg === "" ? null : Number(r.area_avg),
      notes: r.notes ? String(r.notes) : "",
    })).filter((r) => r.subject && !Number.isNaN(r.avg_score));

    return new Response(JSON.stringify({ rows, provider: aiResult.provider, model: aiResult.model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("ai-import-test-scores error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
