import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiCall } from "../_shared/aiCall.ts";

import { corsHeaders } from "../_shared/cors.ts";

const PROMPT = `จากเอกสารหลักสูตรสถานศึกษานี้ ให้ดึงข้อมูลรายวิชาทั้งหมดออกมาเป็น JSON array

สำคัญมาก — โครงสร้างหลักสูตรไทยแบ่งเป็น 3 ระดับ:

1. ระดับอนุบาล (อ.2-อ.3):
   - ใช้ทั้งปี (ไม่แยกเทอม) ตั้ง semester = 0
   - hours_per_year = ชั่วโมงต่อปีเต็ม
   - หน่วยกิตปกติ 0 (กิจกรรม/พัฒนาการ)

2. ระดับประถมศึกษา (ป.1-ป.6):
   - แต่ละวิชามีรหัสเดียว ใช้ทั้งปี (ไม่แยกเทอม)
   - ชั่วโมงเป็น "ชม./ปี" เช่น ท11101 ภาษาไทย 1 = 200 ชม./ปี
   - ให้สร้าง 1 รายการ ต่อ 1 วิชา โดยตั้ง semester = 0 (หมายถึงทั้งปี)
   - hours_per_year = ชั่วโมงต่อปีเต็ม (ไม่ต้องหาร)

3. ระดับมัธยมศึกษา (ม.1-ม.6):
   - แต่ละวิชามีรหัสต่างกันในแต่ละเทอม เช่น ท21101 (เทอม1) และ ท21102 (เทอม2)
   - ตารางจะแบ่ง "ภาคเรียนที่ 1" และ "ภาคเรียนที่ 2" ชัดเจน
   - หน่วยกิตและชั่วโมงเป็นต่อเทอม
   - ให้สร้าง 1 รายการ ต่อ 1 วิชา ตามที่ปรากฏในตาราง โดยตั้ง semester = 1 หรือ 2 ตามภาคเรียน

แต่ละรายวิชาต้องมีฟิลด์:
- code: รหัสวิชา เช่น "ท11101", "ค21101" (แปลงเลขไทยเป็นอาราบิก)
- name_th: ชื่อวิชาภาษาไทย
- hours_per_year: จำนวนชั่วโมง (ต่อปีสำหรับประถม, ต่อเทอมสำหรับมัธยม) — เป็นตัวเลขอาราบิก
- credits: หน่วยกิต (ถ้ามี, ไม่มีให้คำนวณ: ประถม = hours/40 ขั้นต่ำ 0.5, มัธยม = ตามที่ระบุในหน่วยกิต)
- grade_level: ระดับชั้น เช่น "อ.2", "อ.3", "ป.1", "ป.2", "ม.1", "ม.4"
- subject_type: "required" (พื้นฐาน), "elective" (เพิ่มเติม), "activity" (กิจกรรมพัฒนาผู้เรียน)
- semester: 0 = ทั้งปี (ประถม), 1 = ภาคเรียนที่ 1 (มัธยม), 2 = ภาคเรียนที่ 2 (มัธยม)

กรุณา:
- แปลงตัวเลขไทย (๑๒๓) เป็นอาราบิก (123) ทั้งหมด
- รวมทุกระดับชั้นที่พบในเอกสาร
- ไม่ต้องใส่แถวรวม (รวมเวลาเรียน, รายวิชาพื้นฐาน ฯลฯ)
- ห้ามสร้างวิชาซ้ำ — ประถมวิชาละ 1 แถว, มัธยมวิชาละ 1 แถว
- ถ้าวิชาไม่มีรหัส ให้สร้างรหัสจากประเภทและระดับชั้น
- ตอบเป็น JSON array เท่านั้น ไม่ต้องมี markdown code block`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: require authenticated admin/director/teacher
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await admin.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", callerId).in("role", ["admin","director","teacher"]).maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { text, pdfBase64 } = body;

    if (!text && !pdfBase64) {
      return new Response(JSON.stringify({ error: "Missing text or pdfBase64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build messages based on input type
    const userContent: any[] = [];

    if (pdfBase64) {
      userContent.push({ type: "image_url", image_url: { url: `data:application/pdf;base64,${pdfBase64}` } });
      userContent.push({ type: "text", text: PROMPT });
    } else {
      userContent.push({ type: "text", text: `${PROMPT}\n\nข้อความหลักสูตร:\n${text.substring(0, 30000)}` });
    }

    // Use aiCall with fallback chain (vision required when PDF is sent)
    let aiResult;
    try {
      aiResult = await aiCall({
        vision: !!pdfBase64,
        json: false,
        temperature: 0.2,
        functionName: "parse-curriculum-pdf",
        userId: callerId,
        messages: [
          { role: "system", content: "You are a data extraction assistant. Extract structured data from Thai school curriculum documents. Always respond with valid JSON arrays only." },
          { role: "user", content: userContent },
        ],
      });
    } catch (err: any) {
      const msg = String(err?.message || err);
      const status = /429|rate limit/i.test(msg) ? 429 : /402|credit/i.test(msg) ? 402 : 500;
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseText = aiResult.content || "[]";
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    let subjects;
    try {
      subjects = JSON.parse(jsonStr);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(JSON.stringify({ subjects }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("parse-curriculum-pdf error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
