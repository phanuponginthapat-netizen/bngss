// AI Import Analyze v2: รองรับหลายตารางต่อไฟล์ (multi-plan) + lookup FK
// รับ: { file_base64, mime_type, file_name } หรือ { text }, user_hint
// คืน: { plans: [ { table, summary, confidence, notes, rows: [...] } ], allowed_tables }
import { aiCall } from "../_shared/aiCall.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { TABLE_ALIAS_MAP, normalizeRowKeys } from "../_shared/importAliases.ts";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rateLimit.ts";

const JOB_BUCKET = "ai-import-temp";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function writeJobStatus(admin: any, path: string, payload: Record<string, unknown>) {
  const body = JSON.stringify({ ...payload, updated_at: new Date().toISOString() });
  const { error } = await admin.storage.from(JOB_BUCKET).upload(path, new Blob([body], { type: "application/json" }), {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(`บันทึกสถานะงานไม่สำเร็จ: ${error.message}`);
}

// ตาราง + columns ที่อนุญาต (รวม _lookup fields ที่จะถูก resolve ฝั่ง execute)
const ALLOWED_TABLES: Record<string, { description: string; columns: Record<string, string> }> = {
  news: {
    description: "ข่าวสาร/ประกาศโรงเรียน",
    columns: { title: "string จำเป็น", content: "string", category: "string", published_at: "ISO timestamp" },
  },
  school_events: {
    description: "กิจกรรม/ปฏิทินโรงเรียน",
    columns: { title: "string จำเป็น", description: "string", event_date: "YYYY-MM-DD", location: "string" },
  },
  classrooms: {
    description: "ห้องเรียน เช่น ป.1/1 ม.3/2",
    columns: { name: "string จำเป็น", grade_level: "string เช่น ป.1, ม.3", capacity: "number", homeroom_teacher: "string ชื่อครูประจำชั้น" },
  },
  subjects: {
    description: "รายวิชา",
    columns: { subject_code: "string เช่น ค11101", subject_name: "string ชื่อวิชา จำเป็น", grade_level: "string", credits: "number", subject_group: "string กลุ่มสาระ" },
  },
  students: {
    description: "นักเรียน",
    columns: {
      student_code: "string จำเป็น unique",
      prefix: "string ด.ช./ด.ญ./นาย/นางสาว",
      first_name: "string จำเป็น",
      last_name: "string จำเป็น",
      date_of_birth: "YYYY-MM-DD",
      gender: "ชาย/หญิง",
      classroom_name: "string ชื่อห้อง เช่น ป.1/1 (จะถูก lookup เป็น classroom_id อัตโนมัติ)",
    },
  },
  personnel: {
    description: "บุคลากร/ครู",
    columns: {
      employee_code: "string จำเป็น unique (ถ้าไม่มีในเอกสาร ให้สร้างจากชื่อ เช่น T-ดาราณี)",
      prefix: "string (นาย/นาง/นางสาว/ครู — ถ้าไม่ทราบใส่ 'ครู')",
      first_name: "string จำเป็น (ชื่อต้นเท่านั้น ไม่รวมคำว่า 'ครู')",
      last_name: "string จำเป็น (ถ้าไม่มีในเอกสารใส่ '-')",
      position: "string ตำแหน่ง", subject_group: "string กลุ่มสาระ",
      email: "string", phone: "string",
    },
  },
  schedules: {
    description: "ตารางสอน/ตารางเรียนรายชั้น (1 row = 1 ช่องวิชาในไฟล์จริง ห้ามรวมหลายคาบใน row เดียว)",
    columns: {
      day_of_week: "number 1-7 (จันทร์=1, อังคาร=2, พุธ=3, พฤหัส=4, ศุกร์=5, เสาร์=6, อาทิตย์=7)",
      period: "number คาบที่ (1,2,3,...)",
      start_time: "HH:MM:SS เช่น 08:30:00",
      end_time: "HH:MM:SS เช่น 09:20:00",
      subject_code: "string รหัสวิชาจากไฟล์เท่านั้น ถ้าในไฟล์ไม่มีรหัสให้เว้นว่าง ห้ามสร้างรหัสจากชื่อครู",
      subject_name: "string ชื่อวิชาบรรทัดแรกในช่องตาราง เช่น คณิตศาสตร์/ภาษาอังกฤษ(หลัก)/Maker space/ซ่อมเสริม",
      classroom_name: "string ชื่อห้องเรียน เช่น ป.4/1 (lookup→classroom_id)",
      teacher_name: "string ชื่อครูเต็ม เช่น 'นางสมหญิง ใจดี'",
      academic_year: "number ค.ศ. เช่น 2025 (พ.ศ. - 543)",
      semester: "number 1 หรือ 2",
    },
  },
  enrollments: {
    description: "การลงทะเบียนเรียน",
    columns: {
      student_code: "string (lookup→student_id)",
      subject_code: "string (lookup→subject_id)",
      classroom_name: "string (lookup→classroom_id)",
      academic_year: "number", semester: "number",
    },
  },
  attendance: {
    description: "บันทึกการเช็คชื่อ",
    columns: {
      student_code: "string (lookup→student_id)",
      attendance_date: "YYYY-MM-DD",
      status: "present/absent/late/leave",
      academic_year: "number", semester: "number", notes: "string",
    },
  },
  behavior_records: {
    description: "บันทึกพฤติกรรมนักเรียน",
    columns: {
      student_code: "string (lookup→student_id)",
      behavior_type: "positive/negative/neutral",
      description: "string จำเป็น",
      points: "number (+/-)",
      record_date: "YYYY-MM-DD",
    },
  },
  homeroom_records: {
    description: "บันทึกโฮมรูม",
    columns: {
      student_code: "string (lookup→student_id)",
      record_date: "YYYY-MM-DD",
      content: "string",
      academic_year: "number",
    },
  },
  student_leave: {
    description: "ใบลานักเรียน",
    columns: {
      student_code: "string (lookup→student_id)",
      leave_type: "ลาป่วย/ลากิจ", start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD",
      reason: "string", status: "pending/approved/rejected",
    },
  },
  staff_leave: {
    description: "ใบลาบุคลากร",
    columns: {
      employee_code: "string (lookup→personnel_id)",
      leave_type: "string", start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD",
      reason: "string", status: "pending/approved/rejected",
    },
  },
  documents: {
    description: "หนังสือ/เอกสารราชการ",
    columns: {
      title: "string จำเป็น", doc_number: "string เลขที่หนังสือ",
      doc_type: "string ประเภท", doc_date: "YYYY-MM-DD",
      from_department: "string จาก", content: "string สรุปเนื้อหา",
    },
  },
  vaccine_records: {
    description: "บันทึกวัคซีนนักเรียน",
    columns: {
      student_code: "string (lookup→student_id)",
      vaccine_name: "string", vaccinated_at: "YYYY-MM-DD",
      dose: "string", notes: "string",
    },
  },
};

const SYSTEM_PROMPT = `คุณคือผู้ช่วย import ข้อมูลเข้าระบบจัดการโรงเรียนไทย
เนื้อหาที่ได้รับอาจมีหลายเรื่องในไฟล์เดียว (เช่น ตารางสอนมีทั้งวิชา/ห้อง/ครู)
หน้าที่ของคุณ:
1) วิเคราะห์ว่าควรนำเข้าเข้า "ตารางใดบ้าง" (อาจหลายตาราง)
2) แตกข้อมูลเป็น rows ตาม schema
3) ตรวจชนิดไฟล์เอง (detected_type) เพื่อให้ผู้ใช้ตรวจสอบ เช่น "ตารางสอนรายชั้น", "รายชื่อนักเรียน DMC", "บัญชีบุคลากร", "ข่าวประกาศ", "ปฏิทินกิจกรรม", "ใบลา" ฯลฯ
4) ตอบกลับเป็น JSON object เดียวเท่านั้น ตามรูปแบบ:

{
  "detected_type": "string สั้น ๆ บอกว่าไฟล์นี้คืออะไร",
  "plans": [
    {
      "table": "ชื่อตาราง",
      "summary": "สรุป",
      "confidence": 0.0-1.0,
      "notes": "หมายเหตุ/คำเตือน",
      "rows": [ { ... } ]
    }
  ]
}

ตารางที่อนุญาตและ schema:
${JSON.stringify(ALLOWED_TABLES, null, 2)}

กฎสำคัญ:
- เรียง plans ตามลำดับ dependency: classrooms/subjects/personnel ก่อน → ค่อย schedules/enrollments/students/attendance ฯลฯ
- ถ้าเจอ "ตารางสอน/ตารางเรียน" ให้สร้าง plans เฉพาะข้อมูลที่อ่านได้จริงจากไฟล์: classrooms + personnel + schedules เป็นหลัก; สร้าง subjects เฉพาะเมื่อมีรหัส/ชื่อวิชาอยู่ในไฟล์จริง และต้องใช้ชื่อวิชา ไม่ใช่ชื่อครู
- ตารางเรียนภาษาไทยมักมีหลายหน้า (ห้องละ 1 หน้า เช่น ป.1, ป.2, ..., ม.3) ต้องอ่านทุกหน้าและรวม schedules เข้าด้วยกัน อย่าข้ามหน้า
- ครูในเอกสารมักเขียนแค่ "ครู<ชื่อต้น>" เช่น "ครูดาราณี" — ให้ดึงเป็น personnel โดย first_name="ดาราณี" last_name="-" prefix="ครู" และ employee_code="T-ดาราณี" (ครูแต่ละคนสร้าง personnel แค่ row เดียว ไม่ซ้ำ)
- teacher_name ใน schedules ให้ใส่ตรงตามที่ปรากฏ เช่น "ครูดาราณี"
- รายวิชา: subject_name ต้องเป็นชื่อวิชาจากบรรทัดแรกของช่องเท่านั้น เช่น "คณิตศาสตร์", "ภาษาอังกฤษ(หลัก)", "วิทยาการคำนวณ", "Maker space", "ซ่อมเสริม"; บรรทัดถัดไปที่ขึ้นต้นด้วย "ครู" คือ teacher_name ห้ามนำชื่อครูไปเป็นชื่อวิชา/รหัสวิชา
- classrooms: ดึงทุกห้องที่พบในไฟล์ (เช่น อ.2, อ.3, ป.1, ป.2, ป.3, ป.4, ป.5, ป.6, ม.1, ม.2, ม.3) — name = "ป.1" หรือ "ป.1/1" ตามที่ปรากฏ, grade_level เช่น "ป.1" หรือ "อ.2"
- schedules: ต้องแตก 1 row ต่อ 1 ช่องคาบในไฟล์ ห้ามรวมหลายคาบ ห้ามสลับวัน/คาบ และต้องคัดลอก subject_name กับ teacher_name จากช่องเดียวกันให้ตรงตามไฟล์
- กิจกรรมอย่าง Maker space/ซ่อมเสริม/ชุมนุม/แนะแนว/ลูกเสือ/ต้านทุจริต ให้รวมเป็น row ปกติ ใช้ subject_name ตามที่ปรากฏ ไม่ต้องสร้าง proxy ครู
- **สำคัญมาก:** ทุก row ของ schedules ต้องมี classroom_name เสมอ! ให้ดึงจาก header ของแต่ละหน้า/ตาราง (เช่น "ตารางเรียนชั้น ป.1/1" → classroom_name="ป.1/1") แล้วใส่ใน "ทุก row" ของหน้านั้น ห้ามเว้น
- **สำคัญมาก:** ถ้าช่องมี 2 บรรทัด เช่น "คณิตศาสตร์" และ "ครูธนภร" ให้ subject_name="คณิตศาสตร์", teacher_name="ครูธนภร" เท่านั้น ห้ามสร้าง "T-ครู..." หรือ "วิชาของครู..." เมื่อมีชื่อวิชาอยู่แล้ว
- ถ้าในช่องมีแต่ชื่อครูจริง ๆ และไม่มีชื่อวิชาเลย ให้เว้น subject_code และใช้ subject_name="ไม่ระบุวิชา" พร้อม teacher_name ตามไฟล์ เพื่อให้ระบบแจ้งเตือนตรวจสอบภายหลัง
- start_time/end_time: อ่านจาก header ของตาราง เช่น "8.30 - 9.30" → start_time="08:30:00" end_time="09:30:00"
- ระบุ academic_year และ semester ให้ครบทุก row ของ schedules (ดูจาก header ของไฟล์ — พ.ศ. แปลงเป็น ค.ศ. เช่น 2569 → 2026)
- day_of_week ใช้เลข 1-7 (จันทร์=1, อังคาร=2, พุธ=3, พฤหัสบดี=4, ศุกร์=5, เสาร์=6, อาทิตย์=7) แม้ไฟล์จะระบุเป็นชื่อวัน
- ห้ามแต่งข้อมูล ใส่เฉพาะที่มีจริงในเอกสาร
- ถ้าไม่ตรงตารางใดเลย: plans = []
- จำกัด rows ต่อ plan ไม่เกิน 500 แถว`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const rl = await rateLimit(req, { name: "ai-import-analyze", limit: 10, windowMs: 60_000 });
    if (rl.blocked) return rl.response!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin"]).limit(1).maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { file_base64, mime_type, file_name, storage_path, text, user_hint, mode, job_path } = await req.json().catch(() => ({}));
    // AI key handled by aiCall (DB providers + key pool fallback)

    if (mode === "poll") {
      if (!job_path || !String(job_path).startsWith(`${user.id}/`)) return jsonResponse({ error: "Invalid job" }, 400);
      const { data: blob, error } = await admin.storage.from(JOB_BUCKET).download(job_path);
      if (error || !blob) return jsonResponse({ error: "ยังไม่พบสถานะงาน" }, 404);
      const status = JSON.parse(await blob.text());
      return jsonResponse(status);
    }

    const shouldQueue = mode === "async" || !!storage_path;
    if (shouldQueue) {
      const id = crypto.randomUUID();
      const statusPath = `${user.id}/jobs/${id}.json`;
      await writeJobStatus(admin, statusPath, { status: "processing", progress: 10, message: "กำลังวิเคราะห์เอกสารด้วย AI" });

      EdgeRuntime.waitUntil((async () => {
        try {
          const result = await analyzeImport(admin, { file_base64, mime_type, file_name, storage_path, text, user_hint });
          await writeJobStatus(admin, statusPath, { status: "completed", progress: 100, ...result });
        } catch (e: any) {
          console.error("ai-import-analyze background error:", e);
          await writeJobStatus(admin, statusPath, { status: "failed", progress: 100, error: e.message || "วิเคราะห์ไม่สำเร็จ" }).catch(() => {});
        }
      })());

      return jsonResponse({ status: "processing", job_path: statusPath, message: "เริ่มวิเคราะห์แล้ว" }, 202);
    }

    const result = await analyzeImport(admin, { file_base64, mime_type, file_name, storage_path, text, user_hint });
    return jsonResponse(result);
  } catch (e: any) {
    console.error("ai-import-analyze error:", e);
    return jsonResponse({ error: e.message || "internal_error" }, 500);
  }
});

async function analyzeImport(admin: any, input: any) {
    const { file_base64, mime_type, file_name, storage_path, text, user_hint } = input;

    // ถ้าไฟล์ใหญ่ ส่งผ่าน storage แทน base64
    let resolvedBase64 = file_base64;
    let resolvedMime = mime_type;
    let resolvedName = file_name;
    if (storage_path && !resolvedBase64) {
      const { data: blob, error: dlErr } = await admin.storage.from(JOB_BUCKET).download(storage_path);
      if (dlErr || !blob) throw new Error(`ดาวน์โหลดไฟล์จาก storage ไม่สำเร็จ: ${dlErr?.message || "unknown"}`);
      resolvedBase64 = arrayBufferToBase64(await blob.arrayBuffer());
      resolvedMime = resolvedMime || blob.type || "application/pdf";
      resolvedName = resolvedName || storage_path.split("/").pop();
    }

    const userContent: any[] = [];
    if (resolvedBase64 && resolvedMime) {
      userContent.push({ type: "image_url", image_url: { url: `data:${resolvedMime};base64,${resolvedBase64}` } });
    }
    const promptText = [
      `ชื่อไฟล์: ${resolvedName || "(ไม่ระบุ)"}`,
      user_hint ? `คำแนะนำผู้ใช้: ${user_hint}` : "",
      text ? `เนื้อหา:\n${String(text).substring(0, 30000)}` : "",
      "วิเคราะห์และตอบเป็น JSON ตามรูปแบบ (plans เป็น array)",
    ].filter(Boolean).join("\n\n");
    userContent.push({ type: "text", text: promptText });

    // ลบไฟล์ temp หลังใช้
    if (storage_path) {
      admin.storage.from(JOB_BUCKET).remove([storage_path]).catch(() => {});
    }

    const aiResult = await aiCall({
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userContent }],
      json: true,
      vision: true,
      temperature: 0.2,
      functionName: "ai-import-analyze",
    });
    const responseText = aiResult.content || "{}";
    let parsed: any;
    try { parsed = JSON.parse(responseText); }
    catch { const m = responseText.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }

    // backward-compat: ถ้า AI คืน single plan ให้ห่อเป็น array
    let plans: any[] = [];
    if (Array.isArray(parsed.plans)) plans = parsed.plans;
    else if (parsed.table) plans = [parsed];

    // Normalize row keys ผ่าน alias map ก่อนกรอง (กัน AI คืน key ภาษาไทย/พิมพ์ใหญ่)
    // แล้วค่อยกรองคอลัมน์ที่ไม่อยู่ใน schema
    plans = plans
      .filter((p) => p && ALLOWED_TABLES[p.table])
      .map((p) => {
        const schema = ALLOWED_TABLES[p.table];
        const allowed = new Set(Object.keys(schema.columns));
        const aliasMap = TABLE_ALIAS_MAP[p.table];
        const rows = (Array.isArray(p.rows) ? p.rows : []).slice(0, 500).map((r: any) => {
          const normalized = aliasMap ? normalizeRowKeys(r || {}, aliasMap) : (r || {});
          const clean: any = {};
          for (const k of Object.keys(normalized)) if (allowed.has(k)) clean[k] = (normalized as any)[k];
          return clean;
        }).filter((r: any) => Object.keys(r).length > 0);
        return { ...p, rows };
      })
      .filter((p) => p.rows.length > 0);

    return { plans, allowed_tables: Object.keys(ALLOWED_TABLES), detected_type: parsed.detected_type || null };
}
