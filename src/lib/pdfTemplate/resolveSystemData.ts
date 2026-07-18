import { supabase } from "@/integrations/supabase/client";
import { formatDateLongBE } from "@/lib/dateBE";

export interface SystemData {
  school: Record<string, any>;
  student: Record<string, any>;
  father: Record<string, any>;
  mother: Record<string, any>;
  guardian: Record<string, any>;
  emergency: Record<string, any>;
  academic: Record<string, any>;
  director: Record<string, any>;
  teacher: Record<string, any>;
  user: Record<string, any>;
  form: Record<string, any>;
  visit: Record<string, any>;
  scholarship: Record<string, any>;
  leave: Record<string, any>;
  custom: Record<string, any>;
}

function emptyData(): SystemData {
  return {
    school: {}, student: {}, father: {}, mother: {}, guardian: {}, emergency: {},
    academic: {}, director: {}, teacher: {}, user: {}, form: {}, visit: {},
    scholarship: {}, leave: {}, custom: {},
  };
}

function thDate(d?: string | null): string {
  if (!d) return "";
  return formatDateLongBE(d);
}


/** Load auto-fill data for a public form, given student_code (anon-friendly). */
export async function loadSystemDataForStudent(studentCode: string): Promise<{
  data: SystemData;
  student_id: string | null;
  school_id: string | null;
}> {
  const data = emptyData();
  data.form.date = thDate(new Date().toISOString());

  // 1. student via RPC (security definer)
  const { data: stuRow } = await supabase.rpc("lookup_student_for_public_form" as any, { _code: studentCode });
  const stu: any = Array.isArray(stuRow) ? stuRow[0] : stuRow;
  if (!stu) return { data, student_id: null, school_id: null };

  data.student = {
    prefix: stu.prefix,
    first_name: stu.first_name,
    last_name: stu.last_name,
    full_name: [stu.prefix, stu.first_name, stu.last_name].filter(Boolean).join(""),
    student_code: stu.student_code,
    id_card: stu.national_id,
    birth_date: thDate(stu.date_of_birth),
    birth_province: stu.birth_province,
    gender: stu.gender,
    nationality: stu.nationality,
    ethnicity: stu.ethnicity,
    religion: stu.religion,
    blood_type: stu.blood_type,
    weight: stu.weight,
    height: stu.height,
    address: stu.address,
    phone: stu.phone,
    previous_school: stu.previous_school,
    admission_date: thDate(stu.admission_date),
    special_needs: stu.is_special_needs ? (stu.special_needs_type || stu.special_needs || "มี") : "",
    photo: stu.photo_url,
  };
  data.father = {
    name: stu.father_name,
    id_card: stu.father_id,
    phone: stu.father_phone,
    occupation: stu.father_occupation,
  };
  data.mother = {
    name: stu.mother_name,
    id_card: stu.mother_id,
    phone: stu.mother_phone,
    occupation: stu.mother_occupation,
  };
  data.guardian = {
    name: stu.guardian_name || stu.father_name || stu.mother_name,
    phone: stu.guardian_phone,
    relation: stu.guardian_relation,
  };
  data.emergency = {
    contact: stu.emergency_contact,
    phone: stu.emergency_phone,
  };
  data.visit.guardian_name = data.guardian.name;
  data.visit.guardian_phone = data.guardian.phone;
  data.visit.relation = data.guardian.relation;
  data.visit.address = stu.address;
  data.visit.date = data.form.date;

  // 2. classroom name + homeroom teacher
  if (stu.classroom_id) {
    const { data: cls } = await supabase
      .from("classrooms").select("name, grade_level, homeroom_teacher").eq("id", stu.classroom_id).maybeSingle();
    if (cls) {
      const c: any = cls;
      data.student.classroom = c.name || c.grade_level || "";
      data.teacher.name = c.homeroom_teacher || "";
    }
  }

  // 3. school
  if (stu.school_id) {
    const { data: sch } = await supabase
      .from("schools").select("school_name, school_code, obec_code, address, district, province, postal_code, phone, email, website, director_name, logo_url")
      .eq("id", stu.school_id).maybeSingle();
    if (sch) {
      const s: any = sch;
      data.school = {
        name: s.school_name,
        code: s.school_code,
        obec_code: s.obec_code,
        affiliation: s.obec_code ? "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน" : "",
        address: [s.address, s.district, s.province, s.postal_code].filter(Boolean).join(" "),
        district: s.district,
        province: s.province,
        postal_code: s.postal_code,
        phone: s.phone,
        email: s.email,
        website: s.website,
        director_name: s.director_name,
        logo: s.logo_url,
      };
      data.director.name = s.director_name;
    }
  }

  // 4. academic period (current)
  const { data: ap } = await supabase
    .from("academic_periods").select("academic_year, semester")
    .eq("is_current", true).limit(1).maybeSingle();
  if (ap) {
    data.academic.year = String((ap as any).academic_year || "");
    data.academic.semester = String((ap as any).semester || "");
  }

  return { data, student_id: stu.id, school_id: stu.school_id };
}
