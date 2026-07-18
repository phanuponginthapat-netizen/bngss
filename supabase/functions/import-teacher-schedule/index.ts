// Import individual teacher's schedule (per-teacher PDF) for accurate mapping
// Input: { personnel_id, file_base64, mime_type, academic_year, semester }
// Output: { inserted, updated, skipped, warnings, rows }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiCall } from "../_shared/aiCall.ts";

import { corsHeaders } from "../_shared/cors.ts";

function json(b: any, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function norm(s: string) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "").replace(/[()（）·\-_/.]/g, "");
}

function classKey(s: string) {
  return (s || "").replace(/\s+/g, "").trim();
}

function gradeOf(s?: string) {
  const n = classKey(String(s || "").replace(/[๑-๙]/g, (d) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d))));
  const m = n.match(/([ปม])\.?([1-6])/);
  return m ? `${m[1]}.${m[2]}` : "";
}

function family(name: string) {
  const n = norm(name);
  if (n.includes("คณิต")) return "math";
  if (n.includes("ภาษาไทย")) return "thai";
  if (n.includes("อังกฤษ") && (n.includes("เพิ่ม") || n.includes("สื่อสาร"))) return "english_extra";
  if (n.includes("อังกฤษ")) return "english";
  if (n.includes("วิทยาการคำนวณ")) return "computing";
  if (n.includes("วิทยาศาสตร์")) return "science";
  if (n.includes("สังคม") || n.includes("ประวัติ")) return "social";
  if (n.includes("ศิลป")) return "art";
  if (n.includes("สุขศึกษา") || n.includes("พลศึกษา")) return "health";
  if (n.includes("การงาน") || n.includes("อาชีพ")) return "career";
  if (n.includes("ต้านทุจริต")) return "anti_corruption";
  if (n.includes("แนะแนว")) return "guidance";
  if (n.includes("ลูกเสือ")) return "scout";
  if (n.includes("ชุมนุม")) return "club";
  if (n.includes("ซ่อมเสริม")) return "remedial";
  if (n.includes("maker")) return "maker";
  return "misc";
}

const DAY_MAP: Record<string, number> = {
  "จันทร์": 1, "อังคาร": 2, "พุธ": 3, "พฤหัสบดี": 4, "พฤหัส": 4,
  "ศุกร์": 5, "เสาร์": 6, "อาทิตย์": 7,
  "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6, "sun": 7,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, service);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "super_admin"]).limit(1).maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — admin only" }, 403);

    const { personnel_id, file_base64, mime_type, academic_year, semester, replace_existing } = await req.json();
    if (!personnel_id || !file_base64 || !mime_type) return json({ error: "missing fields" }, 400);

    // Get teacher info
    const { data: teacher, error: tErr } = await admin.from("personnel").select("*").eq("id", personnel_id).single();
    if (tErr || !teacher) return json({ error: "ไม่พบข้อมูลครู" }, 404);

    const teacherDisplay = `${teacher.prefix || "ครู"}${teacher.first_name}${teacher.last_name && teacher.last_name !== "-" ? " " + teacher.last_name : ""}`.trim();

    // Build prompt
    const prompt = `คุณเป็นผู้ช่วยอ่านเอกสารตารางสอนของครู "${teacherDisplay}" จากโรงเรียนไทย
หน้าที่: แตกตารางสอนของครูคนนี้เป็น JSON array แต่ละ row คือ 1 คาบ
รูปแบบที่ตอบ:
{ "rows": [ { "day_of_week": 1-7, "period": <int>, "start_time": "HH:MM:SS", "end_time": "HH:MM:SS", "subject_name": "<ชื่อวิชาเต็ม>", "classroom_name": "<ต้องเป็นห้องเฉพาะเช่น ป.1/1 หรือ ม.2/1 ห้ามตัดเลขห้องออก>", "grade_level": "<เช่น ป.1>", "room": "<สถานที่/ห้องที่ใช้สอน เช่น 'Learning Center', 'ห้องคอม 1', 'โรงยิม' ถ้าไม่ระบุให้เป็น null>" } ] }
กฎ:
- day_of_week: จันทร์=1, อังคาร=2, พุธ=3, พฤหัสบดี=4, ศุกร์=5, เสาร์=6, อาทิตย์=7
- แตก 1 row ต่อ 1 คาบ ห้ามรวม
- classroom_name: ใส่ตามที่ปรากฏในเอกสาร เช่น "ป.1" หรือ "ป.1/1" หรือ "ม.2/2" ถ้าเอกสารระบุแค่ระดับชั้น (เช่น "ป.1") ก็ให้ใส่ "ป.1" ไม่ต้องเติม "/1" เอง (ระบบจะจับคู่ห้องให้)
- room: ห้อง/สถานที่ที่ใช้สอนคาบนั้น (ไม่ใช่ชื่อชั้นเรียน) เช่น "Learning Center", "ห้องวิทยาศาสตร์", "ห้อง LAB", "โรงยิม", "ห้องประชุม" ถ้าเอกสารไม่ระบุให้ตอบ null
- ต้องมี subject_name และ classroom_name ครบทุก row (อ่านจาก header/ช่องในเอกสาร) ห้ามใส่ "undefined" หรือเว้นว่าง
- ถ้าไม่มีเวลา ให้เว้น start_time/end_time เป็น null
- คาบพักกลางวัน/Maker/ชุมนุม/แนะแนว/ลูกเสือ ก็นับเป็น row ปกติ ใช้ subject_name ตามที่ปรากฏ
- ตอบ JSON object เดียวเท่านั้น`;

    // Use aiCall with vision+fallback chain (จะลอง provider ตัวถัดไปอัตโนมัติถ้า Lovable credit หมด)
    const aiResult = await aiCall({
      vision: true,
      json: true,
      temperature: 0.2,
      functionName: "import-teacher-schedule",
      userId: user.id,
      messages: [
        { role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mime_type};base64,${file_base64}` } },
        ] },
      ],
    });
    const content = aiResult.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    const rows: any[] = Array.isArray(parsed.rows) ? parsed.rows : [];

    if (rows.length === 0) return json({ error: "ไม่พบข้อมูลตารางในเอกสาร" }, 400);

    // Preload classrooms + subjects
    const { data: classrooms } = await admin.from("classrooms").select("id, name, grade_level");
    const { data: subjects } = await admin.from("subjects").select("id, code, name_th, grade_level");

    const classroomMap = new Map<string, any>();
    (classrooms || []).forEach((c: any) => {
      classroomMap.set(classKey(c.name), c);
    });

    async function findClassroom(name: string, gradeHint?: string): Promise<string | null> {
      const key = classKey(name);
      const exact = classroomMap.get(key);
      if (exact) return exact.id;
      const grade = gradeHint || gradeOf(name);
      if (!grade) return null;
      const sameGrade = (classrooms || []).filter((c: any) => c.grade_level === grade);
      if (!sameGrade.length) return null;
      // ห้องเดียวในระดับชั้น → ใช้เลย
      if (sameGrade.length === 1) return sameGrade[0].id;
      // หลายห้อง → เลือกห้องที่มีนักเรียนมากสุด
      const ids = sameGrade.map((c: any) => c.id);
      const { data: st } = await admin.from("students").select("classroom_id").in("classroom_id", ids);
      if (st && st.length) {
        const counts = new Map<string, number>();
        st.forEach((r: any) => counts.set(r.classroom_id, (counts.get(r.classroom_id) || 0) + 1));
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        return sorted[0][0];
      }
      return sameGrade[0].id;
    }

    function findSubject(name: string, grade: string | null): string | null {
      if (!name) return null;
      const n = norm(name);
      const f = family(name);
      const candidates = (subjects || []).filter((s: any) => !s.code?.startsWith("T-") && (!grade || !s.grade_level || s.grade_level === grade));
      let best: any = null;
      for (const s of candidates) {
        if (s.code?.startsWith("T-")) continue; // ignore proxy
        const sn = norm(s.name_th);
        if (sn === n && (!grade || !s.grade_level || s.grade_level === grade)) return s.id;
        if (family(s.name_th) === f && !["computing", "maker", "remedial", "club", "guidance", "scout"].includes(f)) return s.id;
        if (sn.includes(n) || n.includes(sn)) {
          if (!grade || !s.grade_level || s.grade_level === grade) best = best || s;
        }
      }
      return best?.id || null;
    }

    const warnings: string[] = [];
    let inserted = 0;
    let skipped = 0;
    // Normalize academic_year to CE (DB convention). UI sometimes passes BE.
    const rawYr = Number(academic_year);
    const yr = rawYr > 2400 ? rawYr - 543 : (rawYr || (new Date().getFullYear() - (new Date().getMonth() >= 4 ? 0 : 1)));
    const sem = Number(semester) || 1;

    // Optionally remove old schedules for this teacher in same year/semester
    if (replace_existing) {
      await admin.from("schedules").delete().eq("teacher_id", personnel_id).eq("academic_year", yr).eq("semester", sem);
    }

    const toInsert: any[] = [];
    for (const r of rows) {
      let day = Number(r.day_of_week);
      if (!day && r.day) day = DAY_MAP[String(r.day).trim()] || 0;
      const period = Number(r.period);
      if (!day || !period) { skipped++; warnings.push(`ข้ามแถวที่ไม่มีวัน/คาบ: ${JSON.stringify(r)}`); continue; }

      const rawName = r.classroom_name ? String(r.classroom_name).trim() : "";
      const classroomName = (rawName && rawName.toLowerCase() !== "undefined" && rawName.toLowerCase() !== "null") ? rawName : "";
      const gradeHint = (r.grade_level ? String(r.grade_level).trim() : "") || gradeOf(classroomName);
      const lookupName = classroomName || gradeHint;
      const cid = lookupName ? await findClassroom(lookupName, gradeHint) : null;
      if (!cid) { skipped++; warnings.push(`ไม่พบห้อง "${classroomName || gradeHint || "?"}" (ระดับ ${gradeHint || "-"})`); continue; }

      const rawSubjectName = r.subject_name ? String(r.subject_name).trim() : "";
      const sid = findSubject(rawSubjectName, r.grade_level || null);
      if (!sid && rawSubjectName) {
        warnings.push(`ยังไม่มีในหลักสูตร: "${rawSubjectName}" (ระดับ ${r.grade_level || "-"}) — บันทึกลงตารางเป็นชื่อก่อน รอจับคู่ภายหลัง`);
      }

      const rawRoom = r.room ? String(r.room).trim() : "";
      const room = (rawRoom && rawRoom.toLowerCase() !== "undefined" && rawRoom.toLowerCase() !== "null") ? rawRoom : null;

      toInsert.push({
        classroom_id: cid,
        subject_id: sid,
        subject_name_raw: sid ? null : (rawSubjectName || null),
        day_of_week: day,
        period,
        start_time: r.start_time || null,
        end_time: r.end_time || null,
        teacher_name: teacherDisplay,
        teacher_id: personnel_id,
        academic_year: yr,
        semester: sem,
        room,
      });

    }

    // Upsert per slot — ลบเฉพาะ row ของครูคนนี้เท่านั้น (ไม่ทับครูคนอื่น)
    let updated = 0;
    for (const row of toInsert) {
      // 1) ถ้ามี slot เดียวกันของครูคนนี้อยู่ → ลบก่อน (อัพเดต)
      const { data: mine } = await admin.from("schedules")
        .select("id")
        .match({ classroom_id: row.classroom_id, day_of_week: row.day_of_week, period: row.period, academic_year: row.academic_year, semester: row.semester, teacher_id: personnel_id });
      if (mine && mine.length) {
        await admin.from("schedules").delete().in("id", mine.map((r: any) => r.id));
        updated++;
      }

      // 2) เช็คว่ามีครูคนอื่นใช้ slot นี้ไหม → ถ้ามี ให้ warning แต่ยังคงบันทึก (รองรับ team teaching)
      const { data: others } = await admin.from("schedules")
        .select("id, teacher_name")
        .match({ classroom_id: row.classroom_id, day_of_week: row.day_of_week, period: row.period, academic_year: row.academic_year, semester: row.semester })
        .neq("teacher_id", personnel_id);
      if (others && others.length) {
        warnings.push(`คาบ ${row.day_of_week}/${row.period} มีครูอื่นสอนอยู่: ${others.map((o: any) => o.teacher_name).join(", ")} — บันทึกซ้อนสำหรับครู ${teacherDisplay}`);
      }

      const { error } = await admin.from("schedules").insert(row);
      if (error) { warnings.push(`insert error: ${error.message}`); skipped++; continue; }
      if (!mine?.length) inserted++;
    }

    return json({ inserted, updated, skipped, total: rows.length, warnings, teacher: teacherDisplay });
  } catch (e: any) {
    console.error("import-teacher-schedule error:", e);
    return json({ error: e.message || String(e) }, 500);
  }
});
