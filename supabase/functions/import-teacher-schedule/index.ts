// Import teacher schedule(s) — supports both:
//   A) single teacher  : { personnel_id, file_base64, mime_type, academic_year, semester, replace_existing }
//   B) batch           : { items: [{ personnel_id?, file_base64, mime_type }], academic_year, semester, replace_existing }
// When personnel_id is omitted (auto mode), the AI reads teacher_name from the file
// and we match/create the personnel record, enabling whole-timetable import.
// Output: { results: [{ teacher, inserted, updated, skipped, total, warnings }], ... }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiCall } from "../_shared/aiCall.ts";

import { corsHeaders } from "../_shared/cors.ts";

function json(b: any, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Normalize: trim, lowercase, strip spaces/punctuation AND convert Thai digits ๐-๙ → 0-9
const THAI_DIGIT_MAP: Record<string, string> = { "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4", "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9" };
function toLatinDigits(s: string): string {
  return String(s || "").replace(/[๐-๙]/g, (d) => THAI_DIGIT_MAP[d] ?? d);
}

function norm(s: string) {
  return toLatinDigits(s || "").trim().toLowerCase().replace(/\s+/g, "").replace(/[()（）·\-_/.]/g, "");
}

function classKey(s: string) {
  return toLatinDigits(String(s || "").replace(/\s+/g, "").trim());
}

function gradeOf(s?: string) {
  const n = classKey(String(s || ""));
  const m = n.match(/([ปม])(\d+)/);
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

// Thai-aware loose normalize: strip tone marks/diacritics for fuzzy matching
function thaiLoose(s: string): string {
  return String(s || "")
    .replace(/[่้๊๋์ฺ]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function stripTeacherPrefix(s: string): string {
  return String(s || "")
    .replace(/^(ครู|อาจารย์|อ\.|นาย|นาง|นางสาว|น\.ส\.|ดร\.|ผศ\.|รศ\.|ว่าที่)\s*/g, "")
    .trim();
}

// Score-based personnel lookup (mirrors ai-import-execute) — prefers real staff over T-* proxies
async function findPersonnelByName(admin: any, name?: string): Promise<any | null> {
  const clean = stripTeacherPrefix(name || "");
  if (!clean) return null;
  const { data: all } = await admin.from("personnel").select("id, employee_code, first_name, last_name").eq("status", "active");
  const list = (all || []) as any[];
  if (!list.length) return null;

  // name อาจมีทั้งชื่อ+นามสกุล
  const [fnRaw = "", ...lnParts] = clean.split(/\s+/);
  const fn = fnRaw.trim();
  const ln = lnParts.join(" ").trim();
  if (!fn) return null;

  const fnNorm = fn.replace(/\s+/g, "").toLowerCase();
  const fnLoose = thaiLoose(fn);

  type Cand = { row: any; score: number };
  const candidates: Cand[] = [];
  for (const r of list) {
    const rfn = String(r.first_name || "").replace(/\s+/g, "").toLowerCase();
    const rfnLoose = thaiLoose(r.first_name || "");
    if (!rfn) continue;
    let score = 0;
    if (rfn === fnNorm) score = 100;
    else if (rfnLoose === fnLoose) score = 90;
    else if (rfn.startsWith(fnNorm) || fnNorm.startsWith(rfn)) score = 80 - Math.abs(rfn.length - fnNorm.length) * 2;
    else if (rfnLoose.startsWith(fnLoose) || fnLoose.startsWith(rfnLoose)) score = 70 - Math.abs(rfnLoose.length - fnLoose.length) * 2;
    else if (rfn.includes(fnNorm) || fnNorm.includes(rfn)) score = 50 - Math.abs(rfn.length - fnNorm.length) * 2;
    else if (rfnLoose.includes(fnLoose) || fnLoose.includes(rfnLoose)) {
      if (Math.min(rfnLoose.length, fnLoose.length) >= 3) score = 40 - Math.abs(rfnLoose.length - fnLoose.length) * 2;
    }
    if (score <= 30) continue;
    if (ln) {
      const rln = String(r.last_name || "").toLowerCase();
      if (rln && rln !== "-") {
        if (rln === ln.toLowerCase()) score += 15;
        else if (rln.includes(ln.toLowerCase()) || ln.toLowerCase().includes(rln)) score += 5;
      }
    }
    if (!String(r.employee_code || "").startsWith("T-")) score += 8;
    candidates.push({ row: r, score });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].row;
}

// Convert Thai digit strings like "ป.๑/๑" / "ม.2/2" / "ป1" into a normalized classroom token
function classroomToken(name: string): string {
  return classKey(name).replace(/^ชั้น/, "").replace(/^ห้อง/, "");
}

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
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin"]).limit(1).maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — admin only" }, 403);

    const body = await req.json();

    // Batch mode: items[] (each may omit personnel_id → auto-detect teacher)
    const items: any[] = Array.isArray(body.items)
      ? body.items
      : [{ personnel_id: body.personnel_id, file_base64: body.file_base64, mime_type: body.mime_type }];
    if (!items.length || items.some((it) => !it.file_base64 || !it.mime_type)) return json({ error: "missing fields" }, 400);

    const rawYr = Number(body.academic_year);
    const yr = rawYr > 2400 ? rawYr - 543 : (rawYr || (new Date().getFullYear() - (new Date().getMonth() >= 4 ? 0 : 1)));
    const sem = Number(body.semester) || 1;
    const replaceExisting = body.replace_existing !== false;

    // Preload classrooms + subjects once for the whole batch
    const { data: classrooms } = await admin.from("classrooms").select("id, name, grade_level");
    const { data: subjects } = await admin.from("subjects").select("id, code, name_th, grade_level");

    const classroomByToken = new Map<string, any>();
    (classrooms || []).forEach((c: any) => { classroomByToken.set(classroomToken(c.name), c); });

    async function findClassroom(name: string, gradeHint?: string): Promise<string | null> {
      const token = classroomToken(name);
      const exact = classroomByToken.get(token);
      if (exact) return exact.id;
      const grade = gradeHint || gradeOf(name);
      if (!grade) return null;
      const sameGrade = (classrooms || []).filter((c: any) => c.grade_level === grade);
      if (!sameGrade.length) return null;
      if (sameGrade.length === 1) return sameGrade[0].id;
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

    // Score-based subject matching: exact > family(+grade) > substring; grade-aware when hint present
    function findSubject(name: string, grade: string | null): string | null {
      if (!name) return null;
      const n = norm(name);
      const f = family(name);
      const candidates = (subjects || []).filter((s: any) => !s.code?.startsWith("T-"));
      let best: { id: string; score: number } | null = null;
      for (const s of candidates) {
        const sn = norm(s.name_th);
        const gradeOk = !grade || !s.grade_level || s.grade_level === grade;
        let score = 0;
        if (sn === n && gradeOk) score = 100;
        else if (sn === n) score = 90; // exact name but different stored grade — still strong
        else if (family(s.name_th) === f && gradeOk && !["computing", "maker", "remedial", "club", "guidance", "scout"].includes(f)) score = 80;
        else if ((sn.includes(n) || n.includes(sn)) && gradeOk) score = 50;
        else if ((sn.includes(n) || n.includes(sn))) score = 40;
        if (score && (!best || score > best.score)) best = { id: s.id, score };
      }
      return best?.id || null;
    }

    const results: any[] = [];
    const allWarnings: string[] = [];

    for (const item of items) {
      const teacherWarnings: string[] = [];
      let inserted = 0, updated = 0, skipped = 0;

      // Resolve teacher: explicit personnel_id OR auto-detect from the file
      let teacher: any = null;
      let teacherDisplay = "";
      if (item.personnel_id) {
        const { data: t } = await admin.from("personnel").select("*").eq("id", item.personnel_id).single();
        if (!t) { results.push({ teacher: "?", error: "ไม่พบข้อมูลครู" }); continue; }
        teacher = t;
      }
      teacherDisplay = teacher
        ? `${teacher.prefix || "ครู"}${teacher.first_name}${teacher.last_name && teacher.last_name !== "-" ? " " + teacher.last_name : ""}`.trim()
        : "";

      // Build prompt (auto mode instructs the model to also read teacher_name per cell)
      const teacherLabel = teacherDisplay || "(ตรวจจับครูจากเอกสารอัตโนมัติ)";
      const prompt = `คุณเป็นผู้ช่วยอ่านเอกสารตารางสอน${teacherDisplay ? `ของครู "${teacherDisplay}"` : "จากโรงเรียนไทย"} 
หน้าที่: แตกตารางสอนเป็น JSON array แต่ละ row คือ 1 คาบ
รูปแบบที่ตอบ:
{ "rows": [ { "day_of_week": 1-7, "period": <int>, "period_span": <int จำนวนคาบติดกันของช่องนั้น ปกติ 1 ถ้าเป็นคาบคู่ให้ใส่ 2 หรือ 3>, "start_time": "HH:MM:SS", "end_time": "HH:MM:SS", "subject_name": "<ชื่อวิชาเต็ม>", "classroom_name": "<ต้องเป็นห้องเฉพาะเช่น ป.1/1 หรือ ม.2/1 ห้ามตัดเลขห้องออก>", "grade_level": "<เช่น ป.1>", "room": "<สถานที่/ห้องที่ใช้สอน เช่น 'Learning Center', 'ห้องคอม 1', 'โรงยิม' ถ้าไม่ระบุให้เป็น null>", "teacher_name": <ชื่อครูผู้สอนคาบนี้ ${teacherDisplay ? "ตามที่รู้อยู่แล้ว" : "อ่านจากเอกสาร (เฉพาะกรณีเอกสารเป็นตารางทั้งโรงเรียน)"}>" } ] }
กฎ:
- day_of_week: จันทร์=1, อังคาร=2, พุธ=3, พฤหัสบดี=4, ศุกร์=5, เสาร์=6, อาทิตย์=7
- แตก 1 row ต่อ 1 คาบ ห้ามรวม — แต่ถ้าช่องในเอกสารถูก "รวมเซลล์" คร่อมหลายคาบ (คาบคู่) ให้แตกทุกคาบและใส่ period_span เท่ากับจำนวนคาบที่คร่อม พร้อม period เริ่มต้นของแต่ละ row ตามจริง
- classroom_name: ใส่ตามที่ปรากฏในเอกสาร เช่น "ป.1" หรือ "ป.1/1" หรือ "ม.2/2" ถ้าเอกสารระบุแค่ระดับชั้น (เช่น "ป.1") ก็ให้ใส่ "ป.1" ไม่ต้องเติม "/1" เอง (ระบบจะจับคู่ห้องให้)
- room: ห้อง/สถานที่ที่ใช้สอนคาบนั้น (ไม่ใช่ชื่อชั้นเรียน) เช่น "Learning Center", "ห้องวิทยาศาสตร์", "ห้อง LAB", "โรงยิม", "ห้องประชุม" ถ้าเอกสารไม่ระบุให้ตอบ null
- ต้องมี subject_name และ classroom_name ครบทุก row (อ่านจาก header/ช่องในเอกสาร) ห้ามใส่ "undefined" หรือเว้นว่าง
- ถ้าไม่มีเวลา ให้เว้น start_time/end_time เป็น null
- คาบพักกลางวัน/Maker/ชุมนุม/แนะแนว/ลูกเสือ ก็นับเป็น row ปกติ ใช้ subject_name ตามที่ปรากฏ
- ตอบ JSON object เดียวเท่านั้น`;

      const aiResult = await aiCall({
        vision: true,
        json: true,
        temperature: 0.2,
        functionName: "import-teacher-schedule",
        userId: user.id,
        messages: [
          { role: "user", content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${item.mime_type};base64,${item.file_base64}` } },
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

      if (rows.length === 0) {
        results.push({ teacher: teacherDisplay || item.personnel_id || "?", error: "ไม่พบข้อมูลตารางในเอกสาร" });
        continue;
      }

      // Auto-detect teacher from rows when no personnel_id given
      if (!teacher) {
        const nameFromRows = rows.map((r: any) => String(r.teacher_name || "").trim()).filter((s: string) => s && s.toLowerCase() !== "undefined");
        const primary = [...new Set(nameFromRows)].sort((a, b) => nameFromRows.filter((x) => x === b).length - nameFromRows.filter((x) => x === a).length)[0];
        if (primary) {
          const found = await findPersonnelByName(admin, primary);
          if (found) { teacher = found; teacherDisplay = `${found.prefix || "ครู"}${found.first_name}${found.last_name && found.last_name !== "-" ? " " + found.last_name : ""}`.trim(); }
          else { teacherWarnings.push(`ครู "${primary}" ยังไม่มีในระบบ — สร้าง proxy personnel ให้`); }
        }
      }

      if (replaceExisting && teacher?.id) {
        await admin.from("schedules").delete().eq("teacher_id", teacher.id).eq("academic_year", yr).eq("semester", sem);
      }

      const toInsert: any[] = [];
      for (const r of rows) {
        let day = Number(r.day_of_week);
        if (!day && r.day) day = DAY_MAP[String(r.day).trim()] || 0;
        const period = Number(r.period);
        if (!day || !period) { skipped++; teacherWarnings.push(`ข้ามแถวที่ไม่มีวัน/คาบ: ${JSON.stringify(r)}`); continue; }

        const rawName = r.classroom_name ? String(r.classroom_name).trim() : "";
        const classroomName = (rawName && rawName.toLowerCase() !== "undefined" && rawName.toLowerCase() !== "null") ? rawName : "";
        const gradeHint = (r.grade_level ? String(r.grade_level).trim() : "") || gradeOf(classroomName);
        const lookupName = classroomName || gradeHint;
        const cid = lookupName ? await findClassroom(lookupName, gradeHint) : null;
        if (!cid) { skipped++; teacherWarnings.push(`ไม่พบห้อง "${classroomName || gradeHint || "?"}" (ระดับ ${gradeHint || "-"})`); continue; }

        const rawSubjectName = r.subject_name ? String(r.subject_name).trim() : "";
        const sid = findSubject(rawSubjectName, r.grade_level || null);
        if (!sid && rawSubjectName) {
          teacherWarnings.push(`ยังไม่มีในหลักสูตร: "${rawSubjectName}" (ระดับ ${r.grade_level || "-"}) — บันทึกลงตารางเป็นชื่อก่อน รอจับคู่ภายหลัง`);
        }

        const rawRoom = r.room ? String(r.room).trim() : "";
        const room = (rawRoom && rawRoom.toLowerCase() !== "undefined" && rawRoom.toLowerCase() !== "null") ? rawRoom : null;

        // teacher_id: prefer explicit; else auto-created / matched teacher
        toInsert.push({
          classroom_id: cid,
          subject_id: sid,
          subject_name_raw: sid ? null : (rawSubjectName || null),
          day_of_week: day,
          period,
          start_time: r.start_time || null,
          end_time: r.end_time || null,
          teacher_name: teacherDisplay || (teacher ? `${teacher.prefix || "ครู"}${teacher.first_name}`.trim() : ""),
          teacher_id: teacher?.id ?? null,
          academic_year: yr,
          semester: sem,
          room,
          duration_periods: Math.max(1, Math.min(4, Number(r.period_span) || 1)),
        });
      }

      // Merge consecutive same-class/same-subject/adjacent periods → double periods
      const mergeConsecutive = (rows: any[]) => {
        const sorted = [...rows].sort(
          (a, b) =>
            String(a.classroom_id).localeCompare(String(b.classroom_id)) ||
            a.day_of_week - b.day_of_week ||
            a.period - b.period,
        );
        const out: any[] = [];
        for (const row of sorted) {
          const prev = out[out.length - 1];
          const sameSubject = prev &&
            prev.classroom_id === row.classroom_id &&
            prev.day_of_week === row.day_of_week &&
            (prev.subject_id ? prev.subject_id === row.subject_id : prev.subject_name_raw === row.subject_name_raw) &&
            (prev.room || null) === (row.room || null);
          const adjacent = prev && prev.period + (prev.duration_periods || 1) === row.period;
          if (sameSubject && adjacent && (prev.duration_periods || 1) < 4) {
            prev.duration_periods = (prev.duration_periods || 1) + (row.duration_periods || 1);
            prev.end_time = row.end_time || prev.end_time;
            continue;
          }
          out.push({ ...row });
        }
        return out;
      };
      const mergedInsert = mergeConsecutive(toInsert);
      toInsert.length = 0;
      toInsert.push(...mergedInsert);

      const teacherId = teacher?.id ?? null;
      for (const row of toInsert) {
        // 1) delete same teacher's row at this slot (update semantics)
        let mine: any[] = [];
        if (teacherId) {
          const q = await admin.from("schedules")
            .select("id")
            .match({ classroom_id: row.classroom_id, day_of_week: row.day_of_week, period: row.period, academic_year: row.academic_year, semester: row.semester, teacher_id: teacherId });
          mine = q.data || [];
          if (mine.length) { await admin.from("schedules").delete().in("id", mine.map((r: any) => r.id)); updated++; }
        }

        // 2) warn if another teacher occupies the slot (but still insert for team teaching)
        const q2 = await admin.from("schedules")
          .select("id, teacher_name")
          .match({ classroom_id: row.classroom_id, day_of_week: row.day_of_week, period: row.period, academic_year: row.academic_year, semester: row.semester });
        const others = (q2.data || []).filter((o: any) => o.id && !mine.some((m: any) => m.id === o.id));
        if (others.length) {
          teacherWarnings.push(`คาบ ${row.day_of_week}/${row.period} มีครูอื่นสอนอยู่: ${others.map((o: any) => o.teacher_name).join(", ")} — บันทึกซ้อน${teacherDisplay ? `สำหรับครู ${teacherDisplay}` : ""}`);
        }

        const { error } = await admin.from("schedules").insert(row);
        if (error) { teacherWarnings.push(`insert error: ${error.message}`); skipped++; continue; }
        if (!mine.length) inserted++;
      }

      results.push({
        teacher: teacherDisplay || (teacher ? teacher.first_name : "?"),
        inserted, updated, skipped,
        total: rows.length,
        warnings: teacherWarnings,
        auto_detected: !item.personnel_id && !!teacher,
      });
      allWarnings.push(...teacherWarnings);
    }

    const totalInserted = results.reduce((a, r) => a + (r.inserted || 0), 0);
    const totalSkipped = results.reduce((a, r) => a + (r.skipped || 0), 0);
    return json({ ok: true, inserted: totalInserted, skipped: totalSkipped, total: results.length, results, warnings: allWarnings });
  } catch (e: any) {
    console.error("import-teacher-schedule error:", e);
    return json({ error: e.message || String(e) }, 500);
  }
});