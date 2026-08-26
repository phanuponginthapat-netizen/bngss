// Kiosk face download — ให้ตู้ door ดึง descriptors ทั้งหมดได้แม้เป็น anon (bypass RLS ด้วย service_role)
// ใช้แทน supabase.from("student_face_descriptors").select ตรงๆ ที่โดน RLS บล็อกเมื่อไม่ได้ login เป็น staff
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ดึงทั้งหมด (limit 10000) + join students/classrooms
    const { data, error } = await admin
      .from("student_face_descriptors")
      .select("student_id, descriptor, students!inner(id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name,grade_level))")
      .limit(10000);
    if (error) throw error;

    const map = new Map<string, any>();
    for (const row of (data as any[]) || []) {
      const sid = row.student_id;
      const s = row.students;
      const name = `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim();
      const cls = s.classrooms ? `${s.classrooms.grade_level || ""}/${s.classrooms.name || ""}` : "-";
      const code = s.student_code || "";
      const existing = map.get(sid);
      if (existing) existing.descriptors.push(row.descriptor as number[]);
      else map.set(sid, { studentId: sid, studentCode: code, name, classroom: cls, descriptors: [row.descriptor as number[]] });
    }
    const faces = Array.from(map.values());
    return new Response(JSON.stringify({ faces, count: faces.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
