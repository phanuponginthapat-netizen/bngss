import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function ensureSingleRole(adminClient: any, userId: string, role: "admin" | "teacher" | "student" | "director" | "alumni") {
  await adminClient.from("user_roles").delete().eq("user_id", userId);
  const { error } = await adminClient.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}

// Strip null / undefined / empty-string so we never wipe existing data with blanks
function pickDefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    (out as any)[k] = v;
  }
  return out;
}

async function ensureProfileRecord(adminClient: any, opts: {
  userId: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  employeeCode?: string | null;
  studentCode?: string | null;
  positionTitle?: string | null;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  isApproved?: boolean;
}) {
  const profilePayload = {
    id: opts.userId,
    first_name: opts.firstName ?? "",
    last_name: opts.lastName ?? "",
    department: opts.department ?? null,
    employee_code: opts.employeeCode ?? null,
    student_code: opts.studentCode ?? null,
    position_title: opts.positionTitle ?? null,
    phone: opts.phone ?? null,
    gender: opts.gender ?? null,
    date_of_birth: opts.dateOfBirth ?? null,
    is_approved: opts.isApproved ?? true,
  };

  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", opts.userId)
    .maybeSingle();

  if (existingProfile?.id) {
    // Merge: only overwrite columns that actually have a new value
    const updates = pickDefined(profilePayload);
    delete (updates as any).id;
    if (Object.keys(updates).length > 0) {
      const { error } = await adminClient.from("profiles").update(updates).eq("id", opts.userId);
      if (error) throw error;
    }
  } else {
    const { error } = await adminClient.from("profiles").insert(profilePayload);
    if (error) throw error;
  }
}

async function createOrUpdatePersonnelRecord(adminClient: any, opts: {
  userId: string; firstName: string; lastName: string; email: string;
  department?: string; prefix?: string; position?: string; academicStanding?: string;
  phone?: string | null; gender?: string | null; dateOfBirth?: string | null;
  subjectGroup?: string | null;
}) {
  // Look up existing personnel by user_id first (most reliable), then by email
  let existing: any = null;
  {
    const r = await adminClient.from("personnel").select("id, employee_code").eq("user_id", opts.userId).maybeSingle();
    existing = r.data;
  }
  if (!existing && opts.email) {
    const r = await adminClient.from("personnel").select("id, employee_code").eq("email", opts.email).maybeSingle();
    existing = r.data;
  }
  let employeeCode = existing?.employee_code;
  if (!existing) {
    // Compute next code by scanning the max EMP-#### value, then retry on conflict
    // to avoid race conditions where multiple inserts pick the same number.
    const { data: allCodes } = await adminClient
      .from("personnel")
      .select("employee_code");
    let maxNum = 0;
    for (const row of allCodes ?? []) {
      const m = /^EMP-(\d+)$/.exec((row.employee_code as string) || "");
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    let lastErr: any = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      maxNum += 1;
      employeeCode = `EMP-${String(maxNum).padStart(4, "0")}`;
      const { error: insErr } = await adminClient.from("personnel").insert({
        employee_code: employeeCode, first_name: opts.firstName, last_name: opts.lastName,
        email: opts.email || null, prefix: opts.prefix || "นาย",
        department: opts.department || "วิชาการ", position: opts.position || "ครู",
        academic_standing: opts.academicStanding || null, status: "active",
        phone: opts.phone || null,
        subject_group: opts.subjectGroup || null,
        user_id: opts.userId,
      });
      if (!insErr) { lastErr = null; break; }
      lastErr = insErr;
      // 23505 = unique_violation — try next number
      if ((insErr as any).code !== "23505" && !/duplicate key/i.test(insErr.message)) break;
    }
    if (lastErr) throw new Error(`บันทึกข้อมูลบุคลากรไม่สำเร็จ: ${lastErr.message}`);
  } else {
    const updates: any = { user_id: opts.userId };
    if (opts.position) updates.position = opts.position;
    if (opts.academicStanding !== undefined) updates.academic_standing = opts.academicStanding || null;
    if (opts.department) updates.department = opts.department;
    if (opts.prefix) updates.prefix = opts.prefix;
    if (opts.phone) updates.phone = opts.phone;
    if (opts.subjectGroup !== undefined) updates.subject_group = opts.subjectGroup || null;
    const { error: updErr } = await adminClient.from("personnel").update(updates).eq("id", existing.id);
    if (updErr) throw new Error(`อัปเดตข้อมูลบุคลากรไม่สำเร็จ: ${updErr.message}`);
  }

  // Ensure a profiles row exists, but only set fields if missing —
  // do NOT overwrite values already set by the primary profile upsert.
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id, employee_code")
    .eq("id", opts.userId)
    .maybeSingle();
  if (!existingProfile) {
    await adminClient.from("profiles").insert({
      id: opts.userId,
      first_name: opts.firstName ?? "",
      last_name: opts.lastName ?? "",
      department: opts.department || null,
      employee_code: employeeCode ?? null,
      position_title: opts.position || null,
      phone: opts.phone || null,
      gender: opts.gender || null,
      date_of_birth: opts.dateOfBirth || null,
      is_approved: true,
    });
  } else if (employeeCode && !existingProfile.employee_code) {
    // Only sync auto-generated employee_code if profile is missing it
    await adminClient.from("profiles").update({ employee_code: employeeCode }).eq("id", opts.userId);
  }
}

async function resolveClassroomId(
  adminClient: any,
  gradeLevel?: string,
  room?: string,
) {
  if (!gradeLevel) return null;

  const normalizedRoom = String(room || "").trim();

  if (normalizedRoom) {
    const targetName = normalizedRoom.includes("/") ? normalizedRoom : `${gradeLevel}/${normalizedRoom}`;
    const { data: exact } = await adminClient
      .from("classrooms")
      .select("id")
      .eq("grade_level", gradeLevel)
      .eq("name", targetName)
      .maybeSingle();

    if (exact?.id) return exact.id;

    const { data: created, error: createErr } = await adminClient
      .from("classrooms")
      .insert({ name: targetName, grade_level: gradeLevel, capacity: 40 })
      .select("id")
      .maybeSingle();

    if (createErr) throw createErr;
    return created?.id ?? null;
  }

  const { data: classrooms } = await adminClient
    .from("classrooms")
    .select("id, name, capacity")
    .eq("grade_level", gradeLevel)
    .order("name");

  if (classrooms && classrooms.length > 0) {
    for (const cr of classrooms) {
      const { count } = await adminClient
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("classroom_id", cr.id)
        .eq("status", "active");

      if ((count || 0) < (cr.capacity || 40)) return cr.id;
    }

    const nextSection = classrooms.length + 1;
    const newName = `${gradeLevel}/${nextSection}`;
    const { data: newCr, error: insertErr } = await adminClient
      .from("classrooms")
      .insert({ name: newName, grade_level: gradeLevel, capacity: 40 })
      .select("id")
      .maybeSingle();

    if (insertErr) throw insertErr;
    return newCr?.id ?? null;
  }

  const { data: newCr, error: createErr } = await adminClient
    .from("classrooms")
    .insert({ name: `${gradeLevel}/1`, grade_level: gradeLevel, capacity: 40 })
    .select("id")
    .maybeSingle();

  if (createErr) throw createErr;
  return newCr?.id ?? null;
}

function buildStudentCodeVariants(studentCode?: string | null) {
  const raw = String(studentCode || "").trim();
  if (!raw) return [] as string[];

  const variants = new Set<string>([raw]);
  if (/^\d+$/.test(raw)) {
    const stripped = raw.replace(/^0+/, "") || "0";
    variants.add(stripped);
    for (const width of [4, 5, 6, 7, 8, 10, 13]) {
      variants.add(stripped.padStart(width, "0"));
    }
  }

  return Array.from(variants);
}

function chooseStudentCode(currentCode?: string | null, incomingCode?: string | null) {
  const current = String(currentCode || "").trim();
  const incoming = String(incomingCode || "").trim();
  if (!incoming) return current || null;
  if (!current) return incoming;
  if (current === incoming) return current;

  const currentDigits = current.replace(/\D/g, "");
  const incomingDigits = incoming.replace(/\D/g, "");
  const currentIsShortSchoolCode = currentDigits.length > 0 && currentDigits.length <= 6;
  const incomingIsShortSchoolCode = incomingDigits.length > 0 && incomingDigits.length <= 6;

  if (!currentIsShortSchoolCode && incomingIsShortSchoolCode) return incoming;
  if (currentIsShortSchoolCode && !incomingIsShortSchoolCode) return current;

  return current;
}

async function findExistingStudentRow(adminClient: any, opts: {
  studentCode?: string;
  nationalId?: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ student: { id: string; student_code: string | null; auth_user_id: string | null } | null; matchedBy?: "student_code" | "national_id" | "name" }> {
  if (opts.studentCode) {
    const variants = buildStudentCodeVariants(opts.studentCode);
    if (variants.length > 0) {
      const { data: byCode } = await adminClient
        .from("students")
        .select("id, student_code, auth_user_id")
        .in("student_code", variants)
        .limit(1)
        .maybeSingle();
      if (byCode?.id) return { student: byCode, matchedBy: "student_code" };
    }
  }

  if (opts.nationalId) {
    const nid = String(opts.nationalId).replace(/\D/g, "");
    if (nid.length >= 10) {
      const { data: byNid } = await adminClient
        .from("students")
        .select("id, student_code, auth_user_id")
        .eq("national_id", nid)
        .limit(1)
        .maybeSingle();
      if (byNid?.id) return { student: byNid, matchedBy: "national_id" };
    }
  }

  if (opts.firstName && opts.lastName) {
    const { data: byName } = await adminClient
      .from("students")
      .select("id, student_code, auth_user_id")
      .eq("first_name", opts.firstName)
      .eq("last_name", opts.lastName)
      .limit(1)
      .maybeSingle();
    if (byName?.id) return { student: byName, matchedBy: "name" };
  }

  return { student: null, matchedBy: undefined };
}

async function createStudentRecord(adminClient: any, opts: {
  userId?: string; firstName: string; lastName: string; studentCode: string;
  gradeLevel: string; prefix?: string; nationalId?: string; gender?: string;
  dateOfBirth?: string; phone?: string; address?: string; nationality?: string;
  ethnicity?: string; religion?: string; bloodType?: string;
  fatherName?: string; fatherPhone?: string; fatherId?: string; fatherOccupation?: string;
  motherName?: string; motherPhone?: string; motherId?: string; motherOccupation?: string;
  guardianName?: string; guardianPhone?: string; guardianRelation?: string;
  previousSchool?: string; weight?: number; height?: number; birthProvince?: string;
  classroom?: string;
}): Promise<{ action: "created" | "updated"; matched_by?: "student_code" | "national_id" | "name"; filled_fields: string[] }> {
  const classroomId = await resolveClassroomId(adminClient, opts.gradeLevel, opts.classroom);

  const studentPayload = {
    student_code: opts.studentCode,
    first_name: opts.firstName,
    last_name: opts.lastName,
    prefix: opts.prefix || "ด.ช.",
    classroom_id: classroomId,
    // นำเข้าใหม่ผ่าน DMC: ตั้งเป็น 'pending' รออนุมัติ; existing records จะไม่ถูกเขียนทับ (ดูส่วน merge)
    status: "pending",
    national_id: opts.nationalId || null,
    gender: opts.gender || null,
    date_of_birth: opts.dateOfBirth || null,
    phone: opts.phone || null,
    address: opts.address || null,
    nationality: opts.nationality || null,
    ethnicity: opts.ethnicity || null,
    religion: opts.religion || null,
    blood_type: opts.bloodType || null,
    father_name: opts.fatherName || null,
    father_phone: opts.fatherPhone || null,
    father_id: opts.fatherId || null,
    father_occupation: opts.fatherOccupation || null,
    mother_name: opts.motherName || null,
    mother_phone: opts.motherPhone || null,
    mother_id: opts.motherId || null,
    mother_occupation: opts.motherOccupation || null,
    guardian_name: opts.guardianName || null,
    guardian_phone: opts.guardianPhone || null,
    guardian_relation: opts.guardianRelation || null,
    previous_school: opts.previousSchool || null,
    weight: opts.weight ?? null,
    height: opts.height ?? null,
    birth_province: opts.birthProvince || null,
  };

  const { student: existingStudent, matchedBy } = await findExistingStudentRow(adminClient, {
    studentCode: opts.studentCode,
    nationalId: opts.nationalId,
    firstName: opts.firstName,
    lastName: opts.lastName,
  });
  const existingId = existingStudent?.id ?? null;


  if (existingId) {
    // Merge update: only set columns that have a non-empty value so re-importing
    // a partial DMC file never wipes previously filled fields.
    const linkedUserId = existingStudent?.auth_user_id || opts.userId || null;
    const canonicalStudentCode = chooseStudentCode(existingStudent?.student_code, opts.studentCode);
    const merged = pickDefined({ ...studentPayload, auth_user_id: linkedUserId });
    if (canonicalStudentCode && canonicalStudentCode !== existingStudent?.student_code) {
      merged.student_code = canonicalStudentCode;
    } else {
      delete (merged as any).student_code;
    }
    // ห้ามเขียนทับ status ของ record ที่มีอยู่แล้ว — ให้คงสถานะเดิม (active/graduated/etc.)
    delete (merged as any).status;
    const filled = Object.keys(merged);
    if (filled.length > 0) {
      const { error: updateErr } = await adminClient
        .from("students").update(merged).eq("id", existingId);
      if (updateErr) throw updateErr;
    }
    if (linkedUserId) {
      await ensureProfileRecord(adminClient, {
        userId: linkedUserId, firstName: opts.firstName, lastName: opts.lastName,
        department: opts.gradeLevel, studentCode: canonicalStudentCode,
        phone: opts.phone || null, gender: opts.gender || null,
        dateOfBirth: opts.dateOfBirth || null,
      });
    }
    return { action: "updated", matched_by: matchedBy, filled_fields: filled };
  }

  // No match → create new
  const insertPayload = { ...studentPayload, auth_user_id: opts.userId || null };
  const { error: insertErr } = await adminClient.from("students").insert(insertPayload);
  if (insertErr) throw insertErr;
  if (opts.userId) {
    await ensureProfileRecord(adminClient, {
      userId: opts.userId, firstName: opts.firstName, lastName: opts.lastName,
      department: opts.gradeLevel, studentCode: opts.studentCode,
      phone: opts.phone || null, gender: opts.gender || null,
      dateOfBirth: opts.dateOfBirth || null,
    });
  }
  const filled = Object.keys(pickDefined(insertPayload));
  return { action: "created", filled_fields: filled };
}

async function cleanupStudentRecords(adminClient: any, studentId: string) {
  const tables = [
    "attendance", "behavior_records", "student_leaves", "student_screenings",
    "home_visits", "homeroom_records", "health_records", "early_childhood_dev",
    "sdq_records", "student_subsidies", "student_assessment_scores", "student_column_scores",
    "enrollments",
  ];
  for (const table of tables) {
    await adminClient.from(table).delete().eq("student_id", studentId);
  }
}

async function cleanupPersonnelRecords(adminClient: any, personnelId: string) {
  const tables = [
    "staff_leaves", "staff_evaluations", "salary_records", "id_plan_records",
  ];
  for (const table of tables) {
    await adminClient.from(table).delete().eq("personnel_id", personnelId);
  }
}

function ok(data: any) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!token) throw new Error("Missing authorization token");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error("manage-users auth failed:", userErr?.message);
      throw new Error("Unauthorized: invalid or expired session");
    }
    const caller = userData.user;

    const { data: callerRole } = await adminClient.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (!["admin", "director"].includes(callerRole?.role)) {
      throw new Error("Admin or director access required");
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password, first_name, last_name, role, department, student_code, grade_level, prefix,
              national_id, position, academic_standing, gender, date_of_birth, phone, subject_group } = body;
      if (!email || !password || !first_name || !last_name) throw new Error("Missing required fields");
      const assignedRole = role || "teacher";

      const { data: newUser, error } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { first_name, last_name },
      });
      if (error) throw error;

      await ensureSingleRole(adminClient, newUser.user.id, assignedRole);

      await ensureProfileRecord(adminClient, {
        userId: newUser.user.id,
        firstName: first_name,
        lastName: last_name,
        department: department || null,
        phone: phone || null,
        gender: gender || null,
        dateOfBirth: date_of_birth || null,
      });

      if (assignedRole === "teacher" || assignedRole === "director" || assignedRole === "admin") {
        await createOrUpdatePersonnelRecord(adminClient, {
          userId: newUser.user.id, firstName: first_name, lastName: last_name, email,
          department: department || "วิชาการ", prefix: prefix || "นาย",
          position: position || (assignedRole === "director" ? "ผู้อำนวยการ" : assignedRole === "admin" ? "ผู้ดูแลระบบ" : "ครู"),
          academicStanding: academic_standing,
          phone: phone || null,
          gender: gender || null,
          dateOfBirth: date_of_birth || null,
          subjectGroup: subject_group || null,
        });
      }

      if (assignedRole === "student" && student_code) {
        await createStudentRecord(adminClient, {
          userId: newUser.user.id, firstName: first_name, lastName: last_name,
          studentCode: student_code, gradeLevel: grade_level || "",
          prefix: prefix || "ด.ช.", nationalId: national_id, gender, dateOfBirth: date_of_birth, phone,
        });
      }

      return ok({ success: true, user_id: newUser.user.id });
    }

    if (action === "reset_password") {
      const { user_id, new_password } = body;
      if (!user_id || !new_password) throw new Error("user_id and new_password required");
      if (new_password.length < 6) throw new Error("Password must be at least 6 characters");
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) throw error;
      await adminClient.from("profiles").update({ must_change_password: true } as any).eq("id", user_id);
      return ok({ success: true });
    }

    if (action === "bulk_reset_teachers") {
      // Reset all teachers (and optionally directors) to a temp password, force change at next login.
      const includeDirectors: boolean = !!body.include_directors;
      const customPrefix: string = (body.temp_prefix || "Teacher@").toString();
      const targetRoles = includeDirectors ? ["teacher", "director"] : ["teacher"];

      const { data: roleRows, error: roleErr } = await adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("role", targetRoles);
      if (roleErr) throw roleErr;

      const userIds = [...new Set((roleRows ?? []).map((r: any) => r.user_id).filter(Boolean))];
      if (userIds.length === 0) return ok({ success: true, results: [], total: 0 });

      const { data: profiles, error: profErr } = await adminClient
        .from("profiles")
        .select("id, employee_code, first_name, last_name, position_title, department")
        .in("id", userIds);
      if (profErr) throw profErr;
      const profMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

      // personnel มี prefix/position แยก — เอามาเสริม
      const { data: pers } = await adminClient
        .from("personnel")
        .select("user_id, prefix, position, first_name, last_name")
        .in("user_id", userIds);
      const perMap = new Map<string, any>((pers ?? []).map((p: any) => [p.user_id, p]));

      // Fetch auth emails in pages
      const emailByUid = new Map<string, string>();
      let page = 1;
      while (true) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const list = (data as any)?.users ?? [];
        for (const u of list) emailByUid.set(u.id, u.email || "");
        if (list.length < 200) break;
        page++;
        if (page > 50) break; // safety
      }

      const results: any[] = [];
      for (const uid of userIds) {
        const prof = profMap.get(uid) || {};
        const per = perMap.get(uid) || {};
        const fn = prof.first_name || per.first_name || "";
        const ln = prof.last_name || per.last_name || "";
        const pfx = per.prefix || "";
        const code = (prof.employee_code || uid.slice(0, 6)).toString().replace(/[^A-Za-z0-9]/g, "");
        const rand = String(Math.floor(10 + Math.random() * 90));
        const tempPwd = `${customPrefix}${code}${rand}`;
        try {
          const { error: updErr } = await adminClient.auth.admin.updateUserById(uid, { password: tempPwd });
          if (updErr) throw updErr;
          await adminClient.from("profiles").update({ must_change_password: true } as any).eq("id", uid);
          results.push({
            user_id: uid,
            email: emailByUid.get(uid) || "",
            employee_code: prof.employee_code || "",
            name: `${pfx}${fn} ${ln}`.trim(),
            position: per.position || prof.position_title || "",
            department: prof.department || "",
            temp_password: tempPwd,
            success: true,
          });
        } catch (e: any) {
          results.push({
            user_id: uid,
            email: emailByUid.get(uid) || "",
            employee_code: prof.employee_code || "",
            name: `${pfx}${fn} ${ln}`.trim(),
            success: false,
            error: e?.message || String(e),
          });
        }
      }
      return ok({ success: true, total: userIds.length, results });
     }

    if (action === "bulk_reset_students") {
      // Reset all students to a fixed password. Default: School@1234
      const newPassword: string = (body.new_password || "School@1234").toString();
      const forceChange: boolean = body.force_change === true; // default false (students keep this pwd)
      if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");

      const { data: roleRows, error: roleErr } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (roleErr) throw roleErr;
      const userIds = [...new Set((roleRows ?? []).map((r: any) => r.user_id).filter(Boolean))];
      if (userIds.length === 0) return ok({ success: true, results: [], total: 0 });

      const results: any[] = await Promise.all(userIds.map(async (uid) => {
        try {
          const { error: updErr } = await adminClient.auth.admin.updateUserById(uid, { password: newPassword });
          if (updErr) throw updErr;
          await adminClient.from("profiles").update({ must_change_password: forceChange } as any).eq("id", uid);
          return { user_id: uid, success: true };
        } catch (e: any) {
          return { user_id: uid, success: false, error: e?.message || String(e) };
        }
      }));
      const ok_count = results.filter((r) => r.success).length;
      const fail_count = results.length - ok_count;
      return ok({ success: true, total: userIds.length, ok: ok_count, failed: fail_count, results });

    }

    if (action === "sign_out_all_users") {
      // Force-logout all non-admin users by revoking their sessions via Auth Admin REST API.
      // ใช้เพื่อรีเซ็ตการเชื่อมต่อทั้งหมดเมื่อระบบโหลด/ล็อก session ค้าง
      const excludeAdmins: boolean = body.exclude_admins !== false; // default true
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      let excludeIds: string[] = [];
      if (excludeAdmins) {
        const { data: adminRows } = await adminClient.from("user_roles").select("user_id").eq("role", "admin");
        excludeIds = [...new Set((adminRows ?? []).map((r: any) => r.user_id).filter(Boolean))];
      }

      // List all auth users (paginated)
      const allIds: string[] = [];
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const users = data?.users ?? [];
        for (const u of users) allIds.push(u.id);
        if (users.length < perPage) break;
        page++;
        if (page > 50) break; // safety
      }
      const targetIds = allIds.filter((id) => !excludeIds.includes(id));

      const results = await Promise.all(targetIds.map(async (uid) => {
        try {
          const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${uid}/logout`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceKey}`,
              "apikey": serviceKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ scope: "global" }),
          });
          if (!res.ok && res.status !== 404) {
            const t = await res.text();
            return { user_id: uid, success: false, error: `${res.status}: ${t}` };
          }
          return { user_id: uid, success: true };
        } catch (e: any) {
          return { user_id: uid, success: false, error: e?.message || String(e) };
        }
      }));
      const ok_count = results.filter((r) => r.success).length;
      return ok({ success: true, total: targetIds.length, ok: ok_count, failed: results.length - ok_count });
    }

    if (action === "provision_missing_student_accounts") {
      // สร้าง auth account ให้นักเรียนทุกคนที่ยังไม่มี auth_user_id
      // email = <student_code><email_domain>, password = ค่าที่ส่งมา (default School@12345)
      const newPassword: string = (body.new_password || "School@12345").toString();
      if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");

      // โดเมนอีเมลของโรงเรียน
      const { data: domainRow } = await adminClient
        .from("school_settings").select("setting_value").eq("setting_key", "email_domain").maybeSingle();
      let domain: string = (domainRow?.setting_value || "@school.local").toString().trim();
      if (!domain.startsWith("@")) domain = "@" + domain;

      // นักเรียน active ที่ยังไม่มี auth
      const { data: students, error: stErr } = await adminClient
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, classroom_id, classrooms!students_classroom_id_fkey(grade_level)")
        .is("auth_user_id", null)
        .eq("status", "active");
      if (stErr) throw stErr;

      const targets = (students ?? []).filter((s: any) => s.student_code);
      const concurrency = 8;
      const results: any[] = [];
      for (let i = 0; i < targets.length; i += concurrency) {
        const batch = targets.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(async (s: any) => {
          const email = `${s.student_code}${domain}`.toLowerCase();
          try {
            // หา auth user เดิม (อาจเคยสร้างค้างไว้)
            let userId: string | null = null;
            const { data: existing } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1, email } as any);
            const found = (existing?.users || []).find((u: any) => (u.email || "").toLowerCase() === email);
            if (found) {
              userId = found.id;
              // อัปเดตรหัสผ่านให้ตรง
              await adminClient.auth.admin.updateUserById(userId, { password: newPassword, email_confirm: true });
            } else {
              const { data: created, error: cErr } = await adminClient.auth.admin.createUser({
                email, password: newPassword, email_confirm: true,
                user_metadata: { first_name: s.first_name, last_name: s.last_name, student_code: s.student_code },
              });
              if (cErr) throw cErr;
              userId = created?.user?.id || null;
            }
            if (!userId) throw new Error("no user id");

            // profile + role + students.auth_user_id
            await ensureProfileRecord(adminClient, {
              userId,
              firstName: s.first_name || "",
              lastName: s.last_name || "",
              studentCode: s.student_code,
              department: s.classrooms?.grade_level || null,
              isApproved: true,
            });
            await ensureSingleRole(adminClient, userId, "student");
            await adminClient.from("students").update({ auth_user_id: userId, auth_email: email }).eq("id", s.id);
            await adminClient.from("profiles").update({ must_change_password: false } as any).eq("id", userId);

            return { student_code: s.student_code, email, success: true };
          } catch (e: any) {
            return { student_code: s.student_code, email, success: false, error: e?.message || String(e) };
          }
        }));
        results.push(...batchResults);
      }

      const ok_count = results.filter((r) => r.success).length;
      return ok({
        success: true,
        domain,
        total_students_missing_auth: targets.length,
        ok: ok_count,
        failed: results.length - ok_count,
        results: results.slice(0, 50), // preview only
      });
    }







    if (action === "list_teachers_for_export") {
      const includeDirectors: boolean = !!body.include_directors;
      const targetRoles = includeDirectors ? ["teacher", "director"] : ["teacher"];

      const { data: roleRows, error: roleErr } = await adminClient
        .from("user_roles").select("user_id, role").in("role", targetRoles);
      if (roleErr) throw roleErr;
      const userIds = [...new Set((roleRows ?? []).map((r: any) => r.user_id).filter(Boolean))];
      const roleByUid = new Map<string, string>((roleRows ?? []).map((r: any) => [r.user_id, r.role]));
      if (userIds.length === 0) return ok({ success: true, results: [], total: 0 });

      const { data: profiles, error: profErr2 } = await adminClient
        .from("profiles")
        .select("id, employee_code, first_name, last_name, position_title, department, phone")
        .in("id", userIds);
      if (profErr2) throw profErr2;
      const profMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

      // personnel for subject_group
      const { data: pers } = await adminClient
        .from("personnel")
        .select("user_id, prefix, subject_group, position, position_level, academic_standing, email, first_name, last_name")
        .in("user_id", userIds);
      const perMap = new Map<string, any>((pers ?? []).map((p: any) => [p.user_id, p]));

      // emails
      const emailByUid = new Map<string, string>();
      let page = 1;
      while (true) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const list = (data as any)?.users ?? [];
        for (const u of list) emailByUid.set(u.id, u.email || "");
        if (list.length < 200) break;
        page++;
        if (page > 50) break;
      }

      const results = userIds.map((uid) => {
        const p = profMap.get(uid) || {};
        const per = perMap.get(uid) || {};
        const fn = p.first_name || per.first_name || "";
        const ln = p.last_name || per.last_name || "";
        const pfx = per.prefix || "";
        return {
          user_id: uid,
          email: emailByUid.get(uid) || per.email || "",
          employee_code: p.employee_code || "",
          prefix: pfx,
          first_name: fn,
          last_name: ln,
          full_name: `${pfx}${fn} ${ln}`.trim(),
          role: roleByUid.get(uid) || "teacher",
          position: per.position || p.position_title || "",
          position_level: per.position_level || "",
          academic_standing: per.academic_standing || "",
          subject_group: per.subject_group || "",
          department: p.department || "",
          phone: p.phone || "",
        };
      });
      return ok({ success: true, total: userIds.length, results });
    }

    if (action === "update") {
      const {
        user_id, first_name, last_name, role, department, email, prefix,
        position, academic_standing, subject_group,
        // profile-level
        phone, gender, date_of_birth, address, nickname, bio, line_id, facebook_url,
        emergency_contact, emergency_phone, blood_type, is_approved,
        // identifier codes
        employee_code, student_code,
        // personnel-only
        hire_date,
        // student-only
        national_id, classroom_id, grade_level, classroom_name,
        nationality, ethnicity, religion, weight, height,
        father_name, father_phone, father_id, father_occupation,
        mother_name, mother_phone, mother_id, mother_occupation,
        guardian_name, guardian_phone, guardian_relation,
        previous_school, admission_date, birth_province, special_needs,
        student_status,
      } = body;
      if (!user_id) throw new Error("user_id required");

      // Handle synthetic IDs for orphan personnel / student rows (no auth user yet)
      if (typeof user_id === "string" && (user_id.startsWith("personnel:") || user_id.startsWith("student:"))) {
        const [kind, rowId] = user_id.split(":");
        if (kind === "personnel") {
          const upd: any = {};
          if (first_name !== undefined) upd.first_name = first_name;
          if (last_name !== undefined) upd.last_name = last_name;
          if (prefix !== undefined) upd.prefix = prefix || null;
          if (email !== undefined) upd.email = email || null;
          if (phone !== undefined) upd.phone = phone || null;
          if (department !== undefined) upd.department = department || null;
          if (position !== undefined) upd.position = position || null;
          if (academic_standing !== undefined) upd.academic_standing = academic_standing || null;
          if (subject_group !== undefined) upd.subject_group = subject_group || null;
          if (employee_code !== undefined && employee_code) upd.employee_code = employee_code;
          if (hire_date !== undefined) upd.hire_date = hire_date || null;
          if (Object.keys(upd).length > 0) {
            const { error } = await adminClient.from("personnel").update(upd).eq("id", rowId);
            if (error) throw error;
          }
          return ok({ success: true, synthetic: "personnel" });
        }
        if (kind === "student") {
          const upd: any = {};
          if (first_name !== undefined) upd.first_name = first_name;
          if (last_name !== undefined) upd.last_name = last_name;
          if (prefix !== undefined) upd.prefix = prefix || null;
          if (student_code !== undefined && student_code) upd.student_code = student_code;
          if (national_id !== undefined) upd.national_id = national_id || null;
          if (gender !== undefined) upd.gender = gender || null;
          if (date_of_birth !== undefined) upd.date_of_birth = date_of_birth || null;
          if (phone !== undefined) upd.phone = phone || null;
          if (address !== undefined) upd.address = address || null;
          if (nationality !== undefined) upd.nationality = nationality || null;
          if (ethnicity !== undefined) upd.ethnicity = ethnicity || null;
          if (religion !== undefined) upd.religion = religion || null;
          if (blood_type !== undefined) upd.blood_type = blood_type || null;
          if (weight !== undefined) upd.weight = weight === "" || weight === null ? null : Number(weight);
          if (height !== undefined) upd.height = height === "" || height === null ? null : Number(height);
          if (birth_province !== undefined) upd.birth_province = birth_province || null;
          if (special_needs !== undefined) upd.special_needs = special_needs || null;
          if (previous_school !== undefined) upd.previous_school = previous_school || null;
          if (admission_date !== undefined) upd.admission_date = admission_date || null;
          if (father_name !== undefined) upd.father_name = father_name || null;
          if (father_phone !== undefined) upd.father_phone = father_phone || null;
          if (father_id !== undefined) upd.father_id = father_id || null;
          if (father_occupation !== undefined) upd.father_occupation = father_occupation || null;
          if (mother_name !== undefined) upd.mother_name = mother_name || null;
          if (mother_phone !== undefined) upd.mother_phone = mother_phone || null;
          if (mother_id !== undefined) upd.mother_id = mother_id || null;
          if (mother_occupation !== undefined) upd.mother_occupation = mother_occupation || null;
          if (guardian_name !== undefined) upd.guardian_name = guardian_name || null;
          if (guardian_phone !== undefined) upd.guardian_phone = guardian_phone || null;
          if (guardian_relation !== undefined) upd.guardian_relation = guardian_relation || null;
          if (emergency_contact !== undefined) upd.emergency_contact = emergency_contact || null;
          if (emergency_phone !== undefined) upd.emergency_phone = emergency_phone || null;
          if (student_status !== undefined && student_status) upd.status = student_status;
          if (classroom_id !== undefined) {
            upd.classroom_id = classroom_id || null;
          } else if (grade_level !== undefined) {
            upd.classroom_id = await resolveClassroomId(adminClient, grade_level, classroom_name);
          }
          if (Object.keys(upd).length > 0) {
            const { error } = await adminClient.from("students").update(upd).eq("id", rowId);
            if (error) throw error;
          }
          return ok({ success: true, synthetic: "student" });
        }
      }

      const updateData: any = {};
      if (first_name || last_name) {
        updateData.user_metadata = {};
        if (first_name) updateData.user_metadata.first_name = first_name;
        if (last_name) updateData.user_metadata.last_name = last_name;
      }
      if (email) updateData.email = email;
      if (Object.keys(updateData).length > 0) {
        const { error } = await adminClient.auth.admin.updateUserById(user_id, updateData);
        if (error) throw error;
      }

      if (role) await ensureSingleRole(adminClient, user_id, role);

      const profileUpdate: any = {};
      if (first_name) profileUpdate.first_name = first_name;
      if (last_name) profileUpdate.last_name = last_name;
      if (department !== undefined) profileUpdate.department = department || null;
      if (position !== undefined) profileUpdate.position_title = position || null;
      if (phone !== undefined) profileUpdate.phone = phone || null;
      if (gender !== undefined) profileUpdate.gender = gender || null;
      if (date_of_birth !== undefined) profileUpdate.date_of_birth = date_of_birth || null;
      if (address !== undefined) profileUpdate.address = address || null;
      if (nickname !== undefined) profileUpdate.nickname = nickname || null;
      if (bio !== undefined) profileUpdate.bio = bio || null;
      if (line_id !== undefined) profileUpdate.line_id = line_id || null;
      if (facebook_url !== undefined) profileUpdate.facebook_url = facebook_url || null;
      if (emergency_contact !== undefined) profileUpdate.emergency_contact = emergency_contact || null;
      if (emergency_phone !== undefined) profileUpdate.emergency_phone = emergency_phone || null;
      if (blood_type !== undefined) profileUpdate.blood_type = blood_type || null;
      if (employee_code !== undefined) profileUpdate.employee_code = employee_code || null;
      if (student_code !== undefined) profileUpdate.student_code = student_code || null;
      if (is_approved !== undefined) profileUpdate.is_approved = is_approved;
      if (Object.keys(profileUpdate).length > 0) {
        await adminClient.from("profiles").upsert({ id: user_id, ...profileUpdate }, { onConflict: "id" });
      } else {
        await ensureProfileRecord(adminClient, {
          userId: user_id,
          firstName: first_name,
          lastName: last_name,
          department,
          positionTitle: position,
        });
      }

      if (role === "teacher" || role === "director" || role === "admin") {
        const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(user_id);
        if (targetUser) {
          await createOrUpdatePersonnelRecord(adminClient, {
            userId: user_id,
            firstName: first_name || targetUser.user_metadata?.first_name || "",
            lastName: last_name || targetUser.user_metadata?.last_name || "",
            email: targetUser.email || "", department,
            prefix,
            position: position || (role === "director" ? "ผู้อำนวยการ" : role === "admin" ? "ผู้ดูแลระบบ" : undefined),
            academicStanding: academic_standing,
            subjectGroup: subject_group,
            phone,
          });
          // Apply employee_code / hire_date / status overrides directly (createOrUpdatePersonnelRecord doesn't handle them)
          const personnelUpdate: any = {};
          if (employee_code !== undefined && employee_code) personnelUpdate.employee_code = employee_code;
          if (hire_date !== undefined) personnelUpdate.hire_date = hire_date || null;
          if (Object.keys(personnelUpdate).length > 0) {
            await adminClient.from("personnel").update(personnelUpdate).eq("user_id", user_id);
          }
        }
      }

      // Student record update — applies when target user is a student (or being made one)
      const targetRole = role || (await adminClient.from("user_roles").select("role").eq("user_id", user_id).maybeSingle()).data?.role;
      if (targetRole === "student") {
        const studentUpdate: any = {};
        if (first_name !== undefined) studentUpdate.first_name = first_name;
        if (last_name !== undefined) studentUpdate.last_name = last_name;
        if (prefix !== undefined) studentUpdate.prefix = prefix || null;
        if (student_code !== undefined && student_code) studentUpdate.student_code = student_code;
        if (national_id !== undefined) studentUpdate.national_id = national_id || null;
        if (gender !== undefined) studentUpdate.gender = gender || null;
        if (date_of_birth !== undefined) studentUpdate.date_of_birth = date_of_birth || null;
        if (phone !== undefined) studentUpdate.phone = phone || null;
        if (address !== undefined) studentUpdate.address = address || null;
        if (nationality !== undefined) studentUpdate.nationality = nationality || null;
        if (ethnicity !== undefined) studentUpdate.ethnicity = ethnicity || null;
        if (religion !== undefined) studentUpdate.religion = religion || null;
        if (blood_type !== undefined) studentUpdate.blood_type = blood_type || null;
        if (weight !== undefined) studentUpdate.weight = weight === "" || weight === null ? null : Number(weight);
        if (height !== undefined) studentUpdate.height = height === "" || height === null ? null : Number(height);
        if (birth_province !== undefined) studentUpdate.birth_province = birth_province || null;
        if (special_needs !== undefined) studentUpdate.special_needs = special_needs || null;
        if (previous_school !== undefined) studentUpdate.previous_school = previous_school || null;
        if (admission_date !== undefined) studentUpdate.admission_date = admission_date || null;
        if (father_name !== undefined) studentUpdate.father_name = father_name || null;
        if (father_phone !== undefined) studentUpdate.father_phone = father_phone || null;
        if (father_id !== undefined) studentUpdate.father_id = father_id || null;
        if (father_occupation !== undefined) studentUpdate.father_occupation = father_occupation || null;
        if (mother_name !== undefined) studentUpdate.mother_name = mother_name || null;
        if (mother_phone !== undefined) studentUpdate.mother_phone = mother_phone || null;
        if (mother_id !== undefined) studentUpdate.mother_id = mother_id || null;
        if (mother_occupation !== undefined) studentUpdate.mother_occupation = mother_occupation || null;
        if (guardian_name !== undefined) studentUpdate.guardian_name = guardian_name || null;
        if (guardian_phone !== undefined) studentUpdate.guardian_phone = guardian_phone || null;
        if (guardian_relation !== undefined) studentUpdate.guardian_relation = guardian_relation || null;
        if (emergency_contact !== undefined) studentUpdate.emergency_contact = emergency_contact || null;
        if (emergency_phone !== undefined) studentUpdate.emergency_phone = emergency_phone || null;
        if (student_status !== undefined && student_status) studentUpdate.status = student_status;

        // Resolve classroom: explicit id wins, else use grade_level + classroom_name
        if (classroom_id !== undefined) {
          studentUpdate.classroom_id = classroom_id || null;
        } else if (grade_level !== undefined) {
          studentUpdate.classroom_id = await resolveClassroomId(adminClient, grade_level, classroom_name);
        }

        // Locate student row by auth_user_id first, fallback to student_code
        let studentRow: any = null;
        const byAuth = await adminClient.from("students").select("id").eq("auth_user_id", user_id).maybeSingle();
        studentRow = byAuth.data;
        if (!studentRow && student_code) {
          const byCode = await adminClient.from("students").select("id").eq("student_code", student_code).maybeSingle();
          studentRow = byCode.data;
          if (studentRow) await adminClient.from("students").update({ auth_user_id: user_id }).eq("id", studentRow.id);
        }

        if (studentRow && Object.keys(studentUpdate).length > 0) {
          const { error: stuErr } = await adminClient.from("students").update(studentUpdate).eq("id", studentRow.id);
          if (stuErr) throw stuErr;
        }
      }

      return ok({ success: true });
    }

    if (action === "get_full") {
      const { user_id } = body;
      if (!user_id) throw new Error("user_id required");
      const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(user_id);
      const { data: profile } = await adminClient.from("profiles").select("*").eq("id", user_id).maybeSingle();
      const { data: roleRow } = await adminClient.from("user_roles").select("role").eq("user_id", user_id).maybeSingle();
      const role = roleRow?.role;
      let personnel = null, student = null, classroom = null;
      if (targetUser?.email) {
        const { data } = await adminClient.from("personnel").select("*").eq("email", targetUser.email).maybeSingle();
        personnel = data;
      }
      const { data: stu } = await adminClient.from("students").select("*, classrooms(id, name, grade_level)").eq("auth_user_id", user_id).maybeSingle();
      student = stu;
      if (student?.classrooms) classroom = student.classrooms;
      return ok({
        success: true,
        user: { id: targetUser?.id, email: targetUser?.email, created_at: targetUser?.created_at },
        role,
        profile,
        personnel,
        student,
        classroom,
      });
    }

    if (action === "bulk_create") {
      const { users } = body;
      if (!Array.isArray(users) || users.length === 0) throw new Error("No users provided");

      const { data: listedUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const existingUserByEmail = new Map(
        (listedUsers.users || [])
          .filter((u: any) => !!u.email)
          .map((u: any) => [String(u.email).toLowerCase(), u]),
      );

      const results: any[] = [];
      for (const u of users) {
        const rowName = [u.prefix, u.first_name, u.last_name].filter(Boolean).join(" ");
        try {
          const assignedRole = u.role || "teacher";

          // Skip rows missing the minimum identity required for either path
          if (!u.first_name || !u.last_name) {
            results.push({
              email: u.email || "", name: rowName, success: false, action: "skipped",
              skip_reason: "ไม่มีชื่อ/นามสกุล",
            });
            continue;
          }
          if (assignedRole === "student" && !u.student_code && !(u.first_name && u.last_name)) {
            results.push({
              email: u.email || "", name: rowName, success: false, action: "skipped",
              skip_reason: "ไม่มีรหัสนักเรียนและไม่มีชื่อ-นามสกุลครบ",
            });
            continue;
          }

          const email = String(u.email || "").trim().toLowerCase();
          let userId: string | undefined;
          let authAction: "created" | "updated" | "skipped_auth" = "skipped_auth";

          if (assignedRole === "student") {
            const { student: existingStudent } = await findExistingStudentRow(adminClient, {
              studentCode: u.student_code,
              nationalId: u.national_id,
              firstName: u.first_name,
              lastName: u.last_name,
            });
            if (existingStudent?.auth_user_id) {
              userId = existingStudent.auth_user_id;
              authAction = "updated";
            }
          }

          if (!userId && email) {
            userId = existingUserByEmail.get(email)?.id as string | undefined;
            if (userId) authAction = "updated";
          }

          if (userId) {
            const { error: userUpdateErr } = await adminClient.auth.admin.updateUserById(userId, {
              user_metadata: { first_name: u.first_name, last_name: u.last_name },
            });
            if (userUpdateErr) {
              results.push({ email, name: rowName, success: false, error: userUpdateErr.message, action: "failed" });
              continue;
            }
          }

          if (email && !userId) {
            {
              const { data: newUser, error } = await adminClient.auth.admin.createUser({
                email,
                password: u.password || "School@1234",
                email_confirm: true,
                user_metadata: { first_name: u.first_name, last_name: u.last_name },
              });
              if (error) {
                results.push({ email, name: rowName, success: false, error: error.message, action: "failed" });
                continue;
              }
              userId = newUser.user.id;
              existingUserByEmail.set(email, newUser.user as any);
              authAction = "created";
            }
          }

          if (userId) {
            await ensureSingleRole(adminClient, userId, assignedRole);

            await ensureProfileRecord(adminClient, {
              userId,
              firstName: u.first_name,
              lastName: u.last_name,
              department: u.department || null,
              phone: u.phone || null,
              gender: u.gender || null,
              dateOfBirth: u.date_of_birth || null,
              // นำเข้า DMC: นักเรียนใหม่ต้องรอ admin อนุมัติก่อน
              isApproved: assignedRole === "student" ? false : true,
            });
          }

          let recordAction: "created" | "updated" = authAction === "created" ? "created" : "updated";
          let matchedBy: string | undefined;
          let filledFields: string[] = [];

          if (assignedRole === "teacher" || assignedRole === "director" || assignedRole === "admin") {
            if (userId) {
              await createOrUpdatePersonnelRecord(adminClient, {
                userId,
                firstName: u.first_name,
                lastName: u.last_name,
                email,
                department: u.department || "วิชาการ",
                prefix: u.prefix || "นาย",
                position: u.position || (assignedRole === "director" ? "ผู้อำนวยการ" : assignedRole === "admin" ? "ผู้ดูแลระบบ" : "ครู"),
                academicStanding: u.academic_standing,
                phone: u.phone || null,
                gender: u.gender || null,
                dateOfBirth: u.date_of_birth || null,
                subjectGroup: u.subject_group || null,
              });
              filledFields = Object.keys(pickDefined({
                prefix: u.prefix, position: u.position, academic_standing: u.academic_standing,
                department: u.department, phone: u.phone, gender: u.gender,
                date_of_birth: u.date_of_birth, subject_group: u.subject_group,
              }));
            }
          }

          if (assignedRole === "student") {
            const r = await createStudentRecord(adminClient, {
              userId,
              firstName: u.first_name,
              lastName: u.last_name,
              studentCode: u.student_code || "",
              gradeLevel: u.grade_level || u.department || "",
              prefix: u.prefix || "ด.ช.", nationalId: u.national_id, gender: u.gender,
              dateOfBirth: u.date_of_birth, phone: u.phone, address: u.address,
              nationality: u.nationality, ethnicity: u.ethnicity, religion: u.religion,
              bloodType: u.blood_type,
              fatherName: u.father_name, fatherPhone: u.father_phone, fatherId: u.father_id,
              fatherOccupation: u.father_occupation,
              motherName: u.mother_name, motherPhone: u.mother_phone, motherId: u.mother_id,
              motherOccupation: u.mother_occupation,
              guardianName: u.guardian_name, guardianPhone: u.guardian_phone,
              guardianRelation: u.guardian_relation, previousSchool: u.previous_school,
              weight: u.weight ? parseFloat(u.weight) : undefined,
              height: u.height ? parseFloat(u.height) : undefined,
              birthProvince: u.birth_province,
              classroom: u.classroom,
            });
            recordAction = r.action;
            matchedBy = r.matched_by;
            filledFields = r.filled_fields;
          }

          results.push({
            email, name: rowName, success: true, user_id: userId,
            action: recordAction,
            matched_by: matchedBy,
            filled_fields: filledFields,
            filled_count: filledFields.length,
            student_code: u.student_code || null,
          });
        } catch (e: any) {
          results.push({ email: u.email, name: rowName, success: false, error: e.message, action: "failed" });
        }
      }
      return ok({ success: true, results });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) throw new Error("user_id required");
      if (user_id === caller.id) throw new Error("Cannot delete yourself");

      // Get user info before deleting to clean up related records
      const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(user_id);
      const { data: targetProfile } = await adminClient.from("profiles").select("student_code, employee_code").eq("id", user_id).maybeSingle();

      // Clean up student record if exists
      if (targetProfile?.student_code) {
        const { data: student } = await adminClient.from("students").select("id").eq("student_code", targetProfile.student_code).maybeSingle();
        if (student) {
          await cleanupStudentRecords(adminClient, student.id);
          await adminClient.from("students").delete().eq("id", student.id);
        }
      }

      // Clean up personnel record if exists
      if (targetUser?.email) {
        const { data: person } = await adminClient.from("personnel").select("id").eq("email", targetUser.email).maybeSingle();
        if (person) {
          await cleanupPersonnelRecords(adminClient, person.id);
          await adminClient.from("personnel").delete().eq("id", person.id);
        }
      }

      // Also clean up orphaned profile/role rows so user disappears from list
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("notifications").delete().eq("user_id", user_id);
      await adminClient.from("profiles").delete().eq("id", user_id);

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      // Ignore "User not found" — auth row may already be gone; profile cleanup above still succeeded
      if (error && !/not\s*found/i.test(error.message || "")) throw error;
      return ok({ success: true });
    }

    if (action === "cleanup_orphaned") {
      // Get all existing user emails and student codes
      const { data: { users: allUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
      const { data: profiles } = await adminClient.from("profiles").select("id, student_code, employee_code");

      const userEmails = new Set((allUsers || []).map((u: any) => u.email?.toLowerCase()));
      const userStudentCodes = new Set((profiles || []).filter((p: any) => p.student_code).map((p: any) => p.student_code));

      // Find orphaned personnel (email not in any user)
      const { data: allPersonnel } = await adminClient.from("personnel").select("id, email");
      const orphanedPersonnel = (allPersonnel || []).filter((p: any) => p.email && !userEmails.has(p.email.toLowerCase()));
      for (const p of orphanedPersonnel) {
        await cleanupPersonnelRecords(adminClient, p.id);
        await adminClient.from("personnel").delete().eq("id", p.id);
      }

      // Find orphaned students (student_code not in any profile) — skip graduated students
      const { data: allStudents } = await adminClient.from("students").select("id, student_code, status");
      const orphanedStudents = (allStudents || []).filter((s: any) => s.status !== "graduated" && !userStudentCodes.has(s.student_code));
      for (const s of orphanedStudents) {
        await cleanupStudentRecords(adminClient, s.id);
        await adminClient.from("students").delete().eq("id", s.id);
      }

      return ok({
        success: true,
        cleaned: {
          personnel: orphanedPersonnel.length,
          students: orphanedStudents.length,
        }
      });
    }

    if (action === "cleanup_ghost_teacher_accounts") {
      const { data: roles } = await adminClient.from("user_roles").select("user_id, role").eq("role", "teacher");
      const ghostUserIds: string[] = [];

      for (const roleRow of (roles || [])) {
        const userId = roleRow.user_id;
        const [{ data: personnel }, { data: student }] = await Promise.all([
          adminClient.from("personnel").select("id").eq("user_id", userId).maybeSingle(),
          adminClient.from("students").select("id").eq("auth_user_id", userId).maybeSingle(),
        ]);

        if (!personnel?.id && !student?.id) {
          ghostUserIds.push(userId);
        }
      }

      let deleted = 0;
      for (const uid of ghostUserIds) {
        if (uid === caller.id) continue;
        try {
          await adminClient.from("user_roles").delete().eq("user_id", uid);
          await adminClient.from("notifications").delete().eq("user_id", uid);
          await adminClient.from("profiles").delete().eq("id", uid);
          await adminClient.auth.admin.deleteUser(uid);
          deleted++;
        } catch (e) {
          console.error("cleanup_ghost_teacher_accounts failed for", uid, e);
        }
      }

      return ok({ success: true, deleted, matched: ghostUserIds.length });
    }

    if (action === "graduate_students") {
      const { student_ids } = body;
      if (!Array.isArray(student_ids) || student_ids.length === 0) throw new Error("No student_ids provided");

      // Get all auth users and profiles to find the auth account for each student
      const { data: { users: allAuthUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const { data: allProfiles } = await adminClient.from("profiles").select("id, student_code");
      
      // Map student_code -> auth user id
      const studentCodeToUserId = new Map<string, string>();
      const userIdToEmail = new Map<string, string>();
      for (const p of (allProfiles || [])) {
        if (p.student_code) studentCodeToUserId.set(p.student_code, p.id);
      }
      for (const u of (allAuthUsers || [])) {
        if (u.email) userIdToEmail.set(u.id, u.email);
      }

      // Get student records
      const { data: students } = await adminClient.from("students").select("id, student_code").in("id", student_ids);
      
      let archived = 0;
      for (const st of (students || [])) {
        const authUserId = studentCodeToUserId.get(st.student_code);
        const authEmail = authUserId ? userIdToEmail.get(authUserId) : null;

        // Save auth info to student record
        if (authEmail || authUserId) {
          await adminClient.from("students").update({
            auth_email: authEmail || null,
            auth_user_id: authUserId || null,
          }).eq("id", st.id);
        }

        // Change role to alumni instead of deleting the account
        if (authUserId) {
          await ensureSingleRole(adminClient, authUserId, "alumni");
          archived++;
        }
      }

      return ok({ success: true, archived });
    }

    if (action === "delete_alumni_bulk") {
      const { user_ids } = body;
      if (!Array.isArray(user_ids) || user_ids.length === 0) throw new Error("No user_ids provided");
      
      let deleted = 0;
      for (const uid of user_ids) {
        if (uid === caller.id) continue;
        try {
          const { data: profile } = await adminClient.from("profiles").select("student_code").eq("id", uid).maybeSingle();
          await adminClient.from("user_roles").delete().eq("user_id", uid);
          await adminClient.from("profiles").delete().eq("id", uid);
          await adminClient.auth.admin.deleteUser(uid);
          deleted++;
        } catch (e) {}
      }
      return ok({ success: true, deleted });
    }

    if (action === "delete_by_role") {
      const { role: targetRole } = body;
      if (!targetRole || !["student", "teacher", "director"].includes(targetRole)) {
        throw new Error("Invalid role. Must be student, teacher, or director");
      }

      const { data: { users: allUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));

      const targetUserIds = (allUsers || [])
        .filter((u: any) => {
          const userRole = roleMap.get(u.id);
          if (targetRole === "student") return userRole === "student";
          if (targetRole === "teacher") return userRole === "teacher" || userRole === "director";
          return userRole === targetRole;
        })
        .map((u: any) => u.id)
        .filter((id: string) => id !== caller.id);

      let deleted = 0;
      for (const uid of targetUserIds) {
        try {
          const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(uid);
          const { data: targetProfile } = await adminClient.from("profiles").select("student_code, employee_code").eq("id", uid).maybeSingle();

          if (targetProfile?.student_code) {
            const { data: student } = await adminClient.from("students").select("id").eq("student_code", targetProfile.student_code).maybeSingle();
            if (student) {
              await cleanupStudentRecords(adminClient, student.id);
              await adminClient.from("students").delete().eq("id", student.id);
            }
          }

          if (targetUser?.email) {
            const { data: person } = await adminClient.from("personnel").select("id").eq("email", targetUser.email).maybeSingle();
            if (person) {
              await cleanupPersonnelRecords(adminClient, person.id);
              await adminClient.from("personnel").delete().eq("id", person.id);
            }
          }

          await adminClient.from("user_roles").delete().eq("user_id", uid);
          await adminClient.from("notifications").delete().eq("user_id", uid);
          await adminClient.from("profiles").delete().eq("id", uid);
          await adminClient.auth.admin.deleteUser(uid);
          deleted++;
        } catch (e) {}
      }
      return ok({ success: true, deleted, role: targetRole });
    }

    if (action === "update_role") {
      const { user_id, role } = body;
      if (!user_id || !role) throw new Error("user_id and role required");
      await ensureSingleRole(adminClient, user_id, role);
      if (role === "teacher" || role === "director") {
        const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(user_id);
        if (targetUser) {
          await createOrUpdatePersonnelRecord(adminClient, {
            userId: user_id, firstName: targetUser.user_metadata?.first_name || "",
            lastName: targetUser.user_metadata?.last_name || "", email: targetUser.email || "",
          });
        }
      }
      return ok({ success: true });
    }

    if (action === "list") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
      const { data: profiles } = await adminClient.from("profiles").select("id, first_name, last_name, department, student_code, employee_code, position_title, gender, phone, date_of_birth, is_approved, nickname");
      const { data: personnelList } = await adminClient.from("personnel").select("email, prefix, position, academic_standing, subject_group, user_id");
      const { data: studentRows } = await adminClient.from("students").select("auth_user_id, student_code, prefix, classroom_id, status, classrooms(id, name, grade_level)");
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const personnelByEmail = new Map((personnelList || []).filter((p: any) => p.email).map((p: any) => [p.email, p]));
      const personnelByUserId = new Map((personnelList || []).filter((p: any) => p.user_id).map((p: any) => [p.user_id, p]));
      const studentByAuth = new Map((studentRows || []).filter((s: any) => s.auth_user_id).map((s: any) => [s.auth_user_id, s]));
      const studentByCode = new Map((studentRows || []).filter((s: any) => s.student_code).map((s: any) => [s.student_code, s]));

      for (const u of users || []) {
        if (!profileMap.has(u.id)) {
          await ensureProfileRecord(adminClient, {
            userId: u.id,
            firstName: u.user_metadata?.first_name || "",
            lastName: u.user_metadata?.last_name || "",
          });
        }
      }

      const refreshedProfiles = await adminClient.from("profiles").select("id, first_name, last_name, department, student_code, employee_code, position_title, gender, phone, date_of_birth, is_approved, nickname");
      const refreshedProfileMap = new Map((refreshedProfiles.data || []).map((p: any) => [p.id, p]));

      const userList = (users || []).map((u: any) => {
        const profile = refreshedProfileMap.get(u.id);
        const personnel = personnelByUserId.get(u.id) || personnelByEmail.get(u.email);
        const stu = studentByAuth.get(u.id) || (profile?.student_code ? studentByCode.get(profile.student_code) : null);
        const explicitRole = roleMap.get(u.id);
        const inferredRole = explicitRole || (stu ? "student" : personnel ? "teacher" : null);
        if (!inferredRole) return null;

        return {
          id: u.id,
          email: u.email,
          first_name: profile?.first_name || u.user_metadata?.first_name || "",
          last_name: profile?.last_name || u.user_metadata?.last_name || "",
          role: inferredRole,
          department: profile?.department || "",
          student_code: profile?.student_code || stu?.student_code || "",
          employee_code: profile?.employee_code || "",
          prefix: personnel?.prefix || stu?.prefix || "",
          position_title: personnel?.position || profile?.position_title || "",
          academic_standing: personnel?.academic_standing || "",
          subject_group: personnel?.subject_group || "",
          phone: profile?.phone || "",
          gender: profile?.gender || "",
          date_of_birth: profile?.date_of_birth || "",
          nickname: profile?.nickname || "",
          classroom_id: stu?.classroom_id || null,
          classroom_name: stu?.classrooms?.name || "",
          grade_level: stu?.classrooms?.grade_level || (inferredRole === "student" ? profile?.department || "" : ""),
          student_status: stu?.status || "",
          is_approved: profile?.is_approved ?? false,
          created_at: u.created_at,
        };
      }).filter(Boolean);
      return ok({ success: true, users: userList });
    }

    if (action === "sync_personnel") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
      let synced = 0;
      for (const u of users || []) {
        const role = roleMap.get(u.id);
        await ensureProfileRecord(adminClient, {
          userId: u.id,
          firstName: u.user_metadata?.first_name || "",
          lastName: u.user_metadata?.last_name || "",
        });
        if (role === "teacher" || role === "director" || role === "admin") {
          await createOrUpdatePersonnelRecord(adminClient, {
            userId: u.id,
            firstName: u.user_metadata?.first_name || "",
            lastName: u.user_metadata?.last_name || "",
            email: u.email || "",
            position: role === "director" ? "ผู้อำนวยการ" : role === "admin" ? "ผู้ดูแลระบบ" : undefined,
          });
          synced++;
        }
      }
      return ok({ success: true, synced });
    }

    if (action === "approve") {
      const { user_id, approved } = body;
      if (!user_id) throw new Error("user_id required");
      const { error } = await adminClient
        .from("profiles")
        .update({ is_approved: approved !== false })
        .eq("id", user_id);
      if (error) throw error;
      return ok({ success: true });
    }

    throw new Error("Invalid action");
  } catch (e: any) {
    console.error("manage-users error:", e?.message, e?.stack || e);
    return new Response(JSON.stringify({ error: e?.message || String(e), details: e?.details || null, hint: e?.hint || null }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
