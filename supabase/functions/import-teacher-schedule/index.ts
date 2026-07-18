// Import individual teacher's schedule (per-teacher PDF) for accurate mapping
// Input: { personnel_id, file_base64, mime_type, academic_year, semester }
// Output: { inserted, updated, skipped, warnings, rows }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiCall } from "../_shared/aiCall.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if ((roleRow as any)?.role !== "admin") return json({ error: "Forbidden — admin only" }, 403);

    const body = await req.json();
    const { personnel_id, file_base64, mime_type, academic_year, semester, replace_existing, bulk } = body;
    if (!file_base64 || !mime_type) return json({ error: "missing fields" }, 400);
    if (!bulk && !personnel_id) return json({ error: "missing personnel_id" }, 400);

    // Personnel list for matching (bulk) or single-teacher info
    const { data: allPersonnel } = await admin.from("personnel").select("id, prefix, first_name, last_name, employee_code").eq("status", "active");
    let teacher: any = null;
    let teacherDisplay = "";
    if (!bulk) {
      const { data: t, error: tErr } = await admin.from("personnel").select("*").eq("id", personnel_id).single();
      if (tErr || !t) return json({ error: "ไม่พบข้อมูลครู" }, 404);
      teacher = t;
      teacherDisplay = `${t.prefix || "ครู"}${t.first_name}${t.last_name && t.last_name !== "-" ? " " + t.last_name : ""}`.trim();
    }

    const rowSchema = `{ "day_of_week": 1-7, "period": <int>, "duration_periods": <int default 1>, "start_time": "HH:MM:SS", "end_time": "HH:MM:SS", "subject_name": "<ชื่อวิชาเต็ม>", "classroom_name": "<เช่น ป.1/1 หรือ ป.1 ตามที่เขียน — ห้ามใส่เลขห้องเข้าไป>", "grade_level": "<เช่น ป.1>", "room": "<เลขห้องในวงเล็บ เช่น 211, 222 หรือชื่อสถานที่ เช่น The Click, Learning Center>", "co_teachers": ["<ชื่อครูร่วม>"] }`;
    const prompt = `คุณเป็นผู้ช่วยอ่านเอกสารตารางสอน${bulk ? "หลายหน้า (1 ครู ต่อ 1 หน้า)" : `ของครู "${teacherDisplay}"`} โรงเรียนไทย
หน้าที่: แตกตารางเป็น JSON
${bulk
  ? `{ "teachers": [ { "teacher_name": "<ชื่อครูจากหัวตาราง เช่น ครูจิณห์วรา คำจันทร์>", "rows": [ ${rowSchema} ] } ] }`
  : `{ "rows": [ ${rowSchema} ] }`}

กฎสำคัญ:
- day_of_week: จันทร์=1 อังคาร=2 พุธ=3 พฤหัสบดี=4 ศุกร์=5 เสาร์=6 อาทิตย์=7
- **start_time/end_time**: อ่านจากแถว "เวลา" ของหัวตาราง map ตรงกับ "คาบ N" (เช่น คาบ 1: 08:30-09:30)
- **เซลผสาน**: วิชาเดียวกินหลายคาบ → แตกเป็น row แยกทุกคาบ ตั้ง duration_periods = จำนวนคาบรวม start_time/end_time แต่ละ row ใช้เวลาเฉพาะคาบนั้น
- **เลขห้องในวงเล็บ**: ป้าย "ป.3(211)", "ป.4 (221)", "ม.1/1(305)" — เลข 211/221/305 คือเลขห้อง ให้ใส่ใน room (string)
- ถ้าวงเล็บเป็นชื่อสถานที่ เช่น "(The Click)", "(Learning Center)", "(ห้องคอม)" ก็ใส่ใน room
- classroom_name: เอาเฉพาะส่วน "ป.X" / "ป.X/Y" / "ม.X" / "ม.X/Y" ก่อนวงเล็บ ห้ามใส่เลขห้อง
- **ครูสอนร่วม**: ถ้ามีครู >1 ใน 1 ช่อง ใส่ชื่อครูคนอื่นใน co_teachers (ห้ามใส่ชื่อครูเจ้าของตาราง)
- **คาบควบหลายห้อง**: "ม.6/1,6/2" → 1 row ต่อ 1 ห้อง
- **รวมทุกอย่าง**: รวมกิจกรรมด้วย เช่น หน้าเสาธง โฮมรูม สวดมนต์ พักเที่ยง ลูกเสือ-เนตรนารี ชุมนุม แนะแนว ซ่อมเสริม Maker PLC ประชุม กิจกรรมพัฒนาผู้เรียน
- ข้ามเฉพาะ: ช่องว่างที่ไม่มีข้อความใด ๆ
- ใส่ subject_name ตามที่เขียนในตาราง เช่น "พักเที่ยง", "หน้าเสาธง", "โฮมรูม" หากเป็นกิจกรรม
- ตอบ JSON object เดียว`;

    const aiResult = await aiCall({
      vision: true, json: true, temperature: 0.2,
      functionName: "import-teacher-schedule",
      userId: user.id,
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mime_type};base64,${file_base64}` } },
      ] }],
    });
    const content = aiResult.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }

    type Group = { display: string; personnelId: string | null; rows: any[] };
    const groups: Group[] = [];
    if (bulk) {
      const arr: any[] = Array.isArray(parsed.teachers) ? parsed.teachers : [];
      for (const t of arr) {
        const name = String(t.teacher_name || "").trim();
        if (!name || !Array.isArray(t.rows) || t.rows.length === 0) continue;
        const nk = norm(name).replace(/^ครู|^teacher|^t\./i, "");
        const match = (allPersonnel || []).find((p: any) => {
          const full = norm(`${p.first_name || ""}${p.last_name && p.last_name !== "-" ? p.last_name : ""}`);
          const first = norm(p.first_name || "");
          return (full && (nk.includes(full) || full.includes(nk))) || (first && nk.includes(first));
        });
        groups.push({ display: name, personnelId: match?.id || null, rows: t.rows });
      }
    } else {
      const rows: any[] = Array.isArray(parsed.rows) ? parsed.rows : [];
      groups.push({ display: teacherDisplay, personnelId: personnel_id, rows });
    }

    if (groups.length === 0 || groups.every(g => g.rows.length === 0)) return json({ error: "ไม่พบข้อมูลตารางในเอกสาร" }, 400);

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
    let updated = 0;
    const perTeacher: any[] = [];
    const rawYr = Number(academic_year);
    const yr = rawYr > 2400 ? rawYr - 543 : (rawYr || (new Date().getFullYear() - (new Date().getMonth() >= 4 ? 0 : 1)));
    const sem = Number(semester) || 1;

    for (const grp of groups) {
      if (!grp.personnelId) { warnings.push(`ข้ามครู "${grp.display}": ไม่พบในระบบบุคลากร (กรุณาเพิ่มก่อน)`); continue; }
      const gpDisplay = grp.display;
      const gpPid = grp.personnelId;

      // Optionally remove old schedules for this teacher
      if (replace_existing) {
        await admin.from("schedules").delete().eq("teacher_id", gpPid).eq("academic_year", yr).eq("semester", sem);
      }

      const toInsert: any[] = [];
      for (const r of grp.rows) {
        let day = Number(r.day_of_week);
        if (!day && r.day) day = DAY_MAP[String(r.day).trim()] || 0;
        const period = Number(r.period);
        if (!day || !period) { skipped++; warnings.push(`[${gpDisplay}] ข้ามแถวที่ไม่มีวัน/คาบ`); continue; }

        // Strip "(123)" tail from classroom_name → put numeric/place into room if missing
        let rawName = r.classroom_name ? String(r.classroom_name).trim() : "";
        let extractedRoom = "";
        const parenMatch = rawName.match(/\(([^)]+)\)\s*$/);
        if (parenMatch) {
          extractedRoom = parenMatch[1].trim();
          rawName = rawName.replace(/\s*\([^)]+\)\s*$/, "").trim();
        }
        const classroomName = (rawName && rawName.toLowerCase() !== "undefined" && rawName.toLowerCase() !== "null") ? rawName : "";
        const gradeHint = (r.grade_level ? String(r.grade_level).trim() : "") || gradeOf(classroomName);
        const lookupName = classroomName || gradeHint;
        const cid = lookupName ? await findClassroom(lookupName, gradeHint) : null;
        if (!cid) { skipped++; warnings.push(`[${gpDisplay}] ไม่พบห้อง "${classroomName || gradeHint || "?"}"`); continue; }

        const rawSubjectName = r.subject_name ? String(r.subject_name).trim() : "";
        const sid = findSubject(rawSubjectName, r.grade_level || null);
        if (!sid && rawSubjectName) {
          warnings.push(`[${gpDisplay}] ยังไม่มีในหลักสูตร: "${rawSubjectName}" (${r.grade_level || "-"})`);
        }

        const rawRoomField = r.room ? String(r.room).trim() : "";
        const roomVal = rawRoomField || extractedRoom;
        const room = (roomVal && roomVal.toLowerCase() !== "undefined" && roomVal.toLowerCase() !== "null") ? roomVal : null;

        toInsert.push({
          classroom_id: cid, subject_id: sid,
          subject_name_raw: sid ? null : (rawSubjectName || null),
          day_of_week: day, period,
          duration_periods: Math.max(1, Number(r.duration_periods) || 1),
          start_time: r.start_time || null, end_time: r.end_time || null,
          teacher_name: gpDisplay, teacher_id: gpPid,
          academic_year: yr, semester: sem, room,
        });
      }

      let ti = 0, tu = 0;
      for (const row of toInsert) {
        const { data: mine } = await admin.from("schedules").select("id")
          .match({ classroom_id: row.classroom_id, day_of_week: row.day_of_week, period: row.period, academic_year: row.academic_year, semester: row.semester, teacher_id: gpPid });
        if (mine && mine.length) {
          await admin.from("schedules").delete().in("id", mine.map((r: any) => r.id));
          tu++;
        }
        const { error } = await admin.from("schedules").insert(row);
        if (error) { warnings.push(`[${gpDisplay}] insert: ${error.message}`); skipped++; continue; }
        if (!mine?.length) ti++;
      }
      inserted += ti; updated += tu;
      perTeacher.push({ teacher: gpDisplay, personnel_id: gpPid, inserted: ti, updated: tu, total_rows: grp.rows.length });
    }

    return json({ inserted, updated, skipped, total: groups.reduce((a, g) => a + g.rows.length, 0), warnings, teacher: bulk ? `${perTeacher.length} ครู` : teacherDisplay, per_teacher: perTeacher });
  } catch (e: any) {
    console.error("import-teacher-schedule error:", e);
    return json({ error: e.message || String(e) }, 500);
  }
});
