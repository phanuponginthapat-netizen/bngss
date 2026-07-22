// AI Import Execute v2: admin-only, รองรับหลาย plans + lookup FK
// รับ: { plans: [{ table, rows }] } หรือ { table, rows } (legacy)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders } from "../_shared/cors.ts";

// คอลัมน์ที่อนุญาตเขียนจริงในแต่ละตาราง
const ALLOWED_COLUMNS: Record<string, string[]> = {
  news: ["title", "content", "category", "published_at"],
  school_events: ["title", "description", "event_date", "location"],
  classrooms: ["name", "grade_level", "capacity", "homeroom_teacher", "academic_year"],
  subjects: ["code", "name_th", "name_en", "grade_level", "credits", "subject_type", "semester", "academic_year", "hours_per_week"],
  students: ["student_code", "prefix", "first_name", "last_name", "date_of_birth", "gender", "classroom_id"],
  personnel: ["employee_code", "prefix", "first_name", "last_name", "position", "subject_group", "email", "phone"],
  schedules: ["day_of_week", "period", "start_time", "end_time", "subject_id", "classroom_id", "teacher_name", "academic_year", "semester"],
  enrollments: ["student_id", "subject_id", "classroom_id", "academic_year", "semester", "status"],
  attendance: ["student_id", "attendance_date", "status", "academic_year", "semester", "notes"],
  behavior_records: ["student_id", "behavior_type", "description", "points", "record_date"],
  homeroom_records: ["student_id", "record_date", "content", "academic_year"],
  student_leave: ["student_id", "leave_type", "start_date", "end_date", "reason", "status"],
  staff_leave: ["personnel_id", "leave_type", "start_date", "end_date", "reason", "status"],
  documents: ["title", "doc_number", "doc_type", "doc_date", "from_department", "content"],
  vaccine_records: ["student_code", "vaccine_name", "vaccinated_at", "dose", "notes"],
};

// strip "ครู" prefix and whitespace
function stripTeacherPrefix(s: string): string {
  return String(s || "").replace(/^(ครู|อาจารย์|นาย|นาง|นางสาว|น\.ส\.|ดร\.|ผอ\.|รอง)\s*/g, "").trim();
}

// normalize Thai classroom name e.g. "ป. 1/1" → "ป.1/1"
function normalizeClassName(s: string): string {
  return String(s || "").replace(/\s+/g, "").trim();
}

function normalizeText(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\s()（）·\-_/.]|และ|ฯ/g, "");
}

function extractGradeLevel(s?: string): string | null {
  const n = normalizeClassName(String(s || "").replace(/[๑-๙]/g, (d) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d))));
  const m = n.match(/([ปม])\.?([1-6])/);
  return m ? `${m[1]}.${m[2]}` : null;
}

function subjectFamily(name?: string): string | null {
  const n = normalizeText(name || "");
  if (!n) return null;
  if (n.includes("คณิต")) return "math";
  if (n.includes("ภาษาไทย")) return "thai";
  if (n.includes("อังกฤษ") && (n.includes("เพิ่ม") || n.includes("สื่อสาร"))) return "english_extra";
  if (n.includes("อังกฤษ")) return "english";
  if (n.includes("วิทยาการคำนวณ")) return "computing";
  if (n.includes("วิทยาศาสตร์")) return "science";
  if (n.includes("สังคม") || n.includes("ประวัติ") || n.includes("ศาสนา") || n.includes("วัฒนธรรม")) return "social";
  if (n.includes("ศิลป")) return "art";
  if (n.includes("สุขศึกษา") || n.includes("พลศึกษา")) return "health";
  if (n.includes("การงาน") || n.includes("อาชีพ")) return "career";
  if (n.includes("ต้านทุจริต")) return "anti_corruption";
  if (n.includes("แนะแนว")) return "guidance";
  if (n.includes("ลูกเสือ")) return "scout";
  if (n.includes("ชุมนุม")) return "club";
  if (n.includes("ซ่อมเสริม")) return "remedial";
  if (n.includes("maker")) return "maker";
  return null;
}

function allowFamilyFallback(name?: string): boolean {
  const n = normalizeText(name || "");
  return !(
    n.includes("วิทยาการคำนวณ") || n.includes("ประวัติ") || n.includes("maker") ||
    n.includes("ซ่อมเสริม") || n.includes("ชุมนุม") || n.includes("แนะแนว") || n.includes("ลูกเสือ")
  );
}

function hashCode(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(36).slice(0, 6).toUpperCase();
}

// ===== Mapping Memory: จำการแมพถาวร เพื่อให้ครั้งต่อไปแมพได้แม่นขึ้น =====
function memKey(s: string): string {
  return normalizeText(stripTeacherPrefix(String(s || ""))).slice(0, 200);
}
async function memLookup(admin: any, entity_type: string, raw: string): Promise<string | null> {
  const k = memKey(raw);
  if (!k) return null;
  const { data } = await admin.from("import_mapping_memory")
    .select("resolved_id").eq("entity_type", entity_type).eq("raw_text_norm", k).maybeSingle();
  return data?.resolved_id || null;
}
async function memSave(admin: any, entity_type: string, raw: string, resolved_id: string, label?: string) {
  const k = memKey(raw);
  if (!k || !resolved_id) return;
  await admin.from("import_mapping_memory").upsert({
    entity_type, raw_text_norm: k, resolved_id, resolved_label: label || raw,
    hit_count: 1,
  }, { onConflict: "entity_type,raw_text_norm", ignoreDuplicates: false }).then(() => {}, () => {});
}

// Thai-aware loose normalize: strip tone marks/diacritics + spaces for fuzzy match
// e.g. "จิราภรณ์" → "จิราภรณ", "พัชรินทร์" → "พัชรินทร", "กันต์ณิฐา" → "กันตณิฐา"
function thaiLoose(s: string): string {
  return String(s || "")
    .replace(/[่้๊๋์ฺ]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

// lookup existing personnel by name with Thai-aware fuzzy matching
// Strategy: exact → prefix/substring → loose (no diacritics) prefix/substring
// Always prefer real personnel (employee_code not starting with "T-") over auto-created proxies
async function findPersonnelByName(admin: any, firstName?: string, lastName?: string) {
  const fn = stripTeacherPrefix(firstName || "");
  if (!fn) return null;
  const ln = lastName && lastName !== "-" ? String(lastName).trim() : "";
  const { data: all } = await admin.from("personnel").select("id, employee_code, first_name, last_name").eq("status", "active");
  const list = (all || []) as any[];
  if (!list.length) return null;

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
    else if (rfn.startsWith(fnNorm) || fnNorm.startsWith(rfn)) {
      // prefix match — closer length = higher score
      score = 80 - Math.abs(rfn.length - fnNorm.length) * 2;
    } else if (rfnLoose.startsWith(fnLoose) || fnLoose.startsWith(rfnLoose)) {
      score = 70 - Math.abs(rfnLoose.length - fnLoose.length) * 2;
    } else if (rfn.includes(fnNorm) || fnNorm.includes(rfn)) {
      score = 50 - Math.abs(rfn.length - fnNorm.length) * 2;
    } else if (rfnLoose.includes(fnLoose) || fnLoose.includes(rfnLoose)) {
      // require min length 3 to avoid trivial matches
      if (Math.min(rfnLoose.length, fnLoose.length) >= 3) score = 40 - Math.abs(rfnLoose.length - fnLoose.length) * 2;
    }
    if (score <= 30) continue;
    // last_name bonus / penalty
    if (ln) {
      const rln = String(r.last_name || "").toLowerCase();
      if (rln && rln !== "-") {
        if (rln === ln.toLowerCase()) score += 15;
        else if (rln.includes(ln.toLowerCase()) || ln.toLowerCase().includes(rln)) score += 5;
      }
    }
    // Prefer real personnel over auto-proxy
    if (!String(r.employee_code || "").startsWith("T-")) score += 8;
    candidates.push({ row: r, score });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].row;
}

// lookup existing subject by name_th/code with grade-aware fuzzy matching
async function findSubjectByName(admin: any, name?: string, gradeLevel?: string | null, code?: string, semester?: number | null) {
  const n = String(name || "").trim();
  const grade = gradeLevel || null;
  if (code) {
    let q = admin.from("subjects").select("id, code, name_th, grade_level, semester").eq("code", code);
    if (semester != null) q = q.or(`semester.eq.${semester},semester.eq.0,semester.is.null`);
    const { data } = await q.limit(5);
    const byGrade = (data || []).find((s: any) => !grade || !s.grade_level || s.grade_level === grade);
    if (byGrade) return byGrade;
  }
  if (!n) return null;
  const nf = subjectFamily(n);
  const nn = normalizeText(n);
  const { data: subjects } = await admin.from("subjects").select("id, code, name_th, grade_level, semester").not("code", "like", "T-%");
  const candidates = (subjects || []).filter((s: any) => !grade || !s.grade_level || s.grade_level === grade);
  let exact = candidates.find((s: any) => normalizeText(s.name_th) === nn);
  if (exact) return exact;
  if (nf && allowFamilyFallback(n)) {
    const fam = candidates.filter((s: any) => subjectFamily(s.name_th) === nf);
    const semMatch = semester == null ? fam : fam.filter((s: any) => s.semester == null || s.semester === 0 || s.semester === semester);
    if (semMatch[0]) return semMatch[0];
    if (fam[0]) return fam[0];
  }
  return candidates.find((s: any) => {
    const sn = normalizeText(s.name_th);
    return sn.includes(nn) || nn.includes(sn);
  }) || null;
}

async function ensureActivitySubject(admin: any, name: string, grade: string, semester: number | null, academicYear?: number) {
  const family = subjectFamily(name) || "misc";
  const code = `IMP-${family}-${grade}-${semester || 0}-${hashCode(name)}`.replace(/\s+/g, "");
  const { data: existed } = await admin.from("subjects").select("id, code").eq("code", code).eq("semester", semester || 0).maybeSingle();
  if (existed) return existed;
  const { data: created } = await admin.from("subjects").insert({
    code,
    name_th: name,
    grade_level: grade,
    semester: semester || 0,
    academic_year: academicYear,
    subject_type: "activity",
    credits: 0,
  }).select("id, code").maybeSingle();
  return created || null;
}

// resolve _lookup fields → FK ids และ map ให้ตรงกับรหัสที่มีอยู่จริงในระบบ
async function resolveRow(admin: any, table: string, row: any): Promise<any> {
  const r = { ...row };

  // normalize: map period_number → period (schedules)
  if (table === "schedules" && r.period_number != null && r.period == null) {
    r.period = r.period_number;
    delete r.period_number;
  }
  // normalize day_of_week ถ้าเป็นชื่อวันไทย
  if (table === "schedules" && typeof r.day_of_week === "string") {
    const m: Record<string, number> = { "จันทร์":1,"จ":1,"อังคาร":2,"อ":2,"พุธ":3,"พ":3,"พฤหัสบดี":4,"พฤหัส":4,"พฤ":4,"ศุกร์":5,"ศ":5,"เสาร์":6,"ส":6,"อาทิตย์":7,"อา":7 };
    const num = m[r.day_of_week.trim()] ?? parseInt(r.day_of_week);
    if (!isNaN(num)) r.day_of_week = num;
  }

  // ===== PERSONNEL plan: หา personnel เดิมจากชื่อ แล้วใช้ employee_code เดิม =====
  if (table === "personnel") {
    const existing = await findPersonnelByName(admin, r.first_name, r.last_name);
    if (existing) {
      // ใช้ employee_code เดิมในระบบ + เก็บข้อมูลเดิม (ไม่ทับชื่อ/นามสกุล)
      r.employee_code = existing.employee_code;
      r._existing_id = existing.id;
    }
  }

  // ===== SUBJECTS plan: map AI field names → real schema, and look up existing =====
  if (table === "subjects") {
    // map AI-style fields to real columns
    if (r.subject_code && !r.code) r.code = r.subject_code;
    if (r.subject_name && !r.name_th) r.name_th = r.subject_name;
    if (r.subject_group && !r.subject_type) r.subject_type = "required";
    delete r.subject_code; delete r.subject_name; delete r.subject_group;

    const existing = await findSubjectByName(admin, r.name_th, r.grade_level || null, r.code || null, r.semester ?? null);
    if (existing) {
      r.code = existing.code;
      r._existing_id = existing.id;
    }
  }

  // ===== CLASSROOMS plan: หา classroom เดิมจากชื่อ (normalize spaces) =====
  if (table === "classrooms" && r.name) {
    const norm = normalizeClassName(r.name);
    const { data } = await admin.from("classrooms").select("id, name").ilike("name", norm).limit(1).maybeSingle();
    if (data) {
      r.name = data.name; // ใช้ชื่อเดิมในระบบ
      r._existing_id = data.id;
    } else {
      r.name = norm;
    }
  }

  // classroom_name → classroom_id (รองรับ normalize)
  if (r.classroom_name && !r.classroom_id) {
    const norm = normalizeClassName(r.classroom_name);
    // 1) memory lookup
    const memId = await memLookup(admin, "classroom", norm);
    if (memId) {
      r.classroom_id = memId;
    } else {
      const grade = extractGradeLevel(norm);
      const { data: allClasses } = await admin.from("classrooms").select("id, name, grade_level");
      const sameGrade = grade ? (allClasses || []).filter((c: any) => c.grade_level === grade) : [];
      const exact = (allClasses || []).find((c: any) => normalizeClassName(c.name) === norm);
      let resolved: any = exact || null;
      if (!resolved && sameGrade.length === 1) resolved = sameGrade[0];
      if (!resolved && sameGrade.length > 0) {
        const ids = sameGrade.map((c: any) => c.id);
        const { data: stRows } = await admin.from("students").select("classroom_id").in("classroom_id", ids);
        const counts = new Map<string, number>();
        (stRows || []).forEach((s: any) => counts.set(s.classroom_id, (counts.get(s.classroom_id) || 0) + 1));
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        resolved = sorted[0] ? sameGrade.find((c: any) => c.id === sorted[0][0]) : sameGrade[0];
      }
      // 2) ถ้ายังไม่พบและ schedule ต้องการห้อง → auto-create classroom
      if (!resolved && grade && (table === "schedules" || table === "students" || table === "enrollments")) {
        const { data: created } = await admin.from("classrooms").insert({ name: norm, grade_level: grade }).select("id, name").maybeSingle();
        if (created) resolved = created;
      }
      if (resolved) {
        r.classroom_id = resolved.id;
        await memSave(admin, "classroom", norm, resolved.id, resolved.name);
      }
    }
    delete r.classroom_name;
  }
  // subject_code/subject_name → subject_id (ลองชื่อก่อน เพราะ AI มักสร้าง code เอง)
  if ((r.subject_code || r.subject_name || r.code || r.name_th) && !r.subject_id && table !== "subjects") {
    const subjName = r.subject_name || r.name_th;
    const subjCode = r.subject_code || r.code;
    let found: any = null;
    let grade: string | null = r.grade_level || null;
    if (!grade && r.classroom_id) {
      const { data: cls } = await admin.from("classrooms").select("grade_level").eq("id", r.classroom_id).maybeSingle();
      grade = cls?.grade_level || null;
    }
    // 1) memory lookup (key = subjName + grade)
    if (subjName) {
      const memId = await memLookup(admin, "subject", `${subjName}|${grade || ""}`);
      if (memId) found = { id: memId };
    }
    if (!found && subjName) {
      const byName = await findSubjectByName(admin, subjName, grade, subjCode, r.semester ?? null);
      if (byName) found = byName;
    }
    if (!found && subjCode) {
      const { data } = await admin.from("subjects").select("id").eq("code", subjCode).maybeSingle();
      if (data) found = data;
    }
    if (!found && table === "schedules" && subjName && grade) {
      found = await ensureActivitySubject(admin, String(subjName).trim(), grade, r.semester ?? 0, r.academic_year);
    }
    if (found) {
      r.subject_id = found.id;
      if (subjName) await memSave(admin, "subject", `${subjName}|${grade || ""}`, found.id, subjName);
    }
    delete r.subject_code; delete r.subject_name; delete r.code; delete r.name_th;
  }
  // student_code → student_id
  if (r.student_code && !r.student_id && table !== "students" && table !== "vaccine_records") {
    const { data } = await admin.from("students").select("id").eq("student_code", r.student_code).maybeSingle();
    if (data) r.student_id = data.id;
    delete r.student_code;
  }
  // employee_code → personnel_id (ลอง code ก่อน ถ้าไม่เจอลองชื่อ)
  if (table !== "personnel") {
    if (r.employee_code && !r.personnel_id) {
      const { data } = await admin.from("personnel").select("id").eq("employee_code", r.employee_code).maybeSingle();
      if (data) r.personnel_id = data.id;
      delete r.employee_code;
    }
    // schedules: teacher_name → memory → personnel เดิม → auto-create proxy
    if (table === "schedules" && r.teacher_name) {
      const fn = stripTeacherPrefix(r.teacher_name);
      // 1) memory
      const memId = await memLookup(admin, "personnel", fn);
      let existing: any = null;
      if (memId) {
        const { data } = await admin.from("personnel").select("id, first_name, last_name").eq("id", memId).maybeSingle();
        if (data) existing = data;
      }
      if (!existing) existing = await findPersonnelByName(admin, fn);
      // 2) auto-create proxy personnel ถ้าไม่เจอ (ครูใหม่ในไฟล์)
      if (!existing && fn) {
        const code = `T-${fn}`.replace(/\s+/g, "");
        const { data: created } = await admin.from("personnel").insert({
          employee_code: code, prefix: "ครู", first_name: fn, last_name: "-",
          position: "ครู (auto-import)",
        }).select("id, first_name, last_name").maybeSingle();
        if (created) existing = created;
      }
      if (existing) {
        r.teacher_name = `${existing.first_name || fn} ${existing.last_name && existing.last_name !== "-" ? existing.last_name : ""}`.trim();
        r._personnel_id = existing.id;
        await memSave(admin, "personnel", fn, existing.id, existing.first_name);
      }
    }
    // schedules: fallback เฉพาะกรณีที่ไฟล์ไม่มีชื่อวิชาเลยจริง ๆ
    if (table === "schedules" && !r.subject_id && r.teacher_name && (!row.subject_name || normalizeText(row.subject_name).includes("ไม่ระบุวิชา"))) {
      const fn = stripTeacherPrefix(r.teacher_name);
      // หา grade_level จาก classroom
      let grade = "ทั่วไป";
      if (r.classroom_id) {
        const { data: cls } = await admin.from("classrooms").select("grade_level").eq("id", r.classroom_id).maybeSingle();
        if (cls?.grade_level) grade = cls.grade_level;
      }
      const proxyCode = `T-${fn}-${grade}`.replace(/\s+/g, "");
      const proxyName = `วิชาของครู${fn}`;
      const sem = r.semester ?? 1;
      // upsert proxy subject (code+semester unique)
      const { data: existed } = await admin.from("subjects").select("id").eq("code", proxyCode).eq("semester", sem).maybeSingle();
      let subjId = existed?.id;
      if (!subjId) {
        const { data: created } = await admin.from("subjects").insert({
          code: proxyCode, name_th: proxyName, grade_level: grade,
          semester: sem, academic_year: r.academic_year, subject_type: "required",
        }).select("id").maybeSingle();
        subjId = created?.id;
      }
      if (subjId) r.subject_id = subjId;
    }
  }
  return r;
}

// upsert key สำหรับตารางที่มี unique constraint จริง ๆ
const UPSERT_KEYS: Record<string, string> = {
  subjects: "code,semester",
  students: "student_code",
  personnel: "employee_code",
};

async function importPlan(admin: any, table: string, rows: any[]) {
  const allowed = new Set(ALLOWED_COLUMNS[table] || []);
  const resolved: any[] = [];
  const metas: any[] = []; // parallel meta for schedules (personnel_id etc.)
  let matchedExisting = 0;
  for (const r of rows) {
    const withFk = await resolveRow(admin, table, r);
    // ถ้าเจอข้อมูลเดิมในระบบสำหรับ personnel/subjects/classrooms → ข้าม ไม่เขียนทับ
    if (withFk._existing_id && (table === "personnel" || table === "subjects" || table === "classrooms")) {
      matchedExisting++;
      continue;
    }
    const clean: any = {};
    for (const k of Object.keys(withFk)) if (allowed.has(k)) clean[k] = withFk[k];
    if (Object.keys(clean).length > 0) {
      resolved.push(clean);
      metas.push({ _personnel_id: withFk._personnel_id });
    }
  }
  if (resolved.length === 0) {
    return { inserted: 0, skipped: rows.length - matchedExisting, matched_existing: matchedExisting, note: matchedExisting > 0 ? `พบของเดิมในระบบ ${matchedExisting} รายการ — ใช้ข้อมูลเดิม` : "ทุก row ว่างหลังกรอง/lookup" };
  }

  if (table === "schedules") {
    let inserted = 0;
    let skipped = rows.length - resolved.length - matchedExisting;
    let replaced = 0;
    let assignments = 0;
    let lastError = "";
    // เก็บ assignment ที่จะ upsert (dedupe ด้วย key)
    const assignSet = new Map<string, any>();
    for (let i = 0; i < resolved.length; i++) {
      const row = resolved[i];
      const meta = metas[i] || {};
      if (!row.classroom_id || !row.subject_id || !row.day_of_week || !row.period) { skipped++; continue; }
      const match: any = { classroom_id: row.classroom_id, day_of_week: row.day_of_week, period: row.period };
      if (row.academic_year != null) match.academic_year = row.academic_year;
      if (row.semester != null) match.semester = row.semester;
      const { data: deleted } = await admin.from("schedules").delete().match(match).select("id");
      if ((deleted || []).length) replaced += (deleted || []).length;
      const { error } = await admin.from("schedules").insert(row);
      if (error) { skipped++; lastError = error.message; continue; }
      inserted++;
      // เก็บ teacher_assignment (ถ้ามี personnel_id จาก resolveRow)
      const pid = meta._personnel_id;
      if (pid && row.subject_id && row.classroom_id) {
        const ay = row.academic_year ?? null;
        const sem = row.semester ?? null;
        const key = `${pid}|${row.subject_id}|${row.classroom_id}|${ay}|${sem}`;
        if (!assignSet.has(key)) {
          assignSet.set(key, {
            personnel_id: pid, subject_id: row.subject_id, classroom_id: row.classroom_id,
            ...(ay != null ? { academic_year: ay } : {}),
            ...(sem != null ? { semester: sem } : {}),
          });
        }
      }
    }
    // upsert teacher_assignments (unique: personnel,subject,classroom,year,sem)
    if (assignSet.size > 0) {
      const arr = [...assignSet.values()];
      const { data: ins, error: aErr } = await admin.from("teacher_assignments")
        .upsert(arr, { onConflict: "personnel_id,subject_id,classroom_id,academic_year,semester", ignoreDuplicates: true })
        .select("id");
      if (!aErr) assignments = ins?.length || arr.length;
    }
    return { inserted, skipped, matched_existing: matchedExisting, replaced, teacher_assignments: assignments, ...(lastError ? { error: lastError } : {}) };
  }

  const upsertKey = UPSERT_KEYS[table];
  let q = admin.from(table);
  const op = upsertKey ? q.upsert(resolved, { onConflict: upsertKey, ignoreDuplicates: false }) : q.insert(resolved);
  const { data, error } = await op.select("id");
  if (error) return { inserted: 0, skipped: resolved.length, matched_existing: matchedExisting, error: error.message };
  return { inserted: data?.length || resolved.length, skipped: rows.length - resolved.length - matchedExisting, matched_existing: matchedExisting };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
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

    const body = await req.json().catch(() => ({}));
    let plans: { table: string; rows: any[] }[] = [];
    if (Array.isArray(body.plans)) plans = body.plans;
    else if (body.table && Array.isArray(body.rows)) plans = [{ table: body.table, rows: body.rows }];

    plans = plans.filter((p) => p.table && ALLOWED_COLUMNS[p.table] && Array.isArray(p.rows) && p.rows.length > 0);
    if (plans.length === 0) {
      return new Response(JSON.stringify({ error: "ไม่มี plan ให้นำเข้า" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const total = plans.reduce((a, p) => a + p.rows.length, 0);
    if (total > 3000) {
      return new Response(JSON.stringify({ error: "เกิน 3000 แถวต่อครั้ง" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // เรียง dependency: ตาราง master ก่อน
    const ORDER = ["classrooms", "subjects", "personnel", "students", "schedules", "enrollments", "attendance", "behavior_records", "homeroom_records", "student_leave", "staff_leave", "documents", "vaccine_records", "news", "school_events"];
    plans.sort((a, b) => ORDER.indexOf(a.table) - ORDER.indexOf(b.table));

    const results: any[] = [];
    for (const p of plans) {
      const r = await importPlan(admin, p.table, p.rows);
      results.push({ table: p.table, ...r });
    }

    try {
      await admin.from("audit_logs").insert({
        user_id: user.id, action: "ai_import",
        details: { results, total_rows: total },
      } as any);
    } catch (_) {}

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ai-import-execute error:", e);
    return new Response(JSON.stringify({ error: e.message || "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
