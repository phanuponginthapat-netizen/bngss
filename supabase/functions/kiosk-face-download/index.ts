// Kiosk face download — ให้ตู้ door ดึง descriptors ทั้งหมดได้แม้เป็น anon (bypass RLS ด้วย service_role)
// รองรับ:
//   ?meta=1     → คืนเฉพาะเวอร์ชัน (จำนวน + เวลาล่าสุด) ไว้เช็คว่าต้องโหลดใหม่ไหม (เบามาก)
//   ?images=1   → แนบภาพใบหน้าที่ลงทะเบียน (face_image) มาด้วย เพื่อเก็บลงเครื่องและใช้ประมวลผลในเครื่อง
//   ?staff=0    → ไม่ต้องเอาบุคลากร (ค่าเริ่มต้นคือเอามาด้วย)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_IMAGES_PER_PERSON = 2; // จำกัดขนาด payload — ใช้ภาพตัวแทนพอ

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let body: any = {};
    if (req.method === "POST") { try { body = await req.json(); } catch { /* ignore */ } }
    const flag = (name: string, def = false) => {
      const q = url.searchParams.get(name);
      const v = q ?? (body?.[name] !== undefined ? String(body[name]) : null);
      if (v === null) return def;
      return v === "1" || v === "true";
    };
    const metaOnly = flag("meta");
    const withImages = flag("images");
    const withStaff = flag("staff", true);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ── เวอร์ชันข้อมูล: จำนวนแถว + เวลาล่าสุด ให้ตู้เทียบว่าข้อมูลเปลี่ยนหรือยัง ──
    const buildVersion = async () => {
      const { count: sCount } = await admin
        .from("student_face_descriptors").select("id", { count: "exact", head: true });
      let pCount = 0;
      try {
        const { count } = await (admin as any)
          .from("personnel_face_descriptors").select("id", { count: "exact", head: true });
        pCount = count ?? 0;
      } catch { /* ไม่มีตารางก็ข้าม */ }
      let latest = "";
      try {
        const { data } = await admin
          .from("student_face_descriptors").select("created_at")
          .order("created_at", { ascending: false }).limit(1);
        latest = (data as any[])?.[0]?.created_at ?? "";
      } catch { /* ignore */ }
      return { students: sCount ?? 0, staff: pCount, latest, version: `${sCount ?? 0}-${pCount}-${latest}` };
    };

    if (metaOnly) {
      const version = await buildVersion();
      return new Response(JSON.stringify({ ...version }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentCols =
      "student_id, descriptor, quality_score" +
      (withImages ? ", face_image" : "") +
      ", students!inner(id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name,grade_level))";

    const { data, error } = await admin
      .from("student_face_descriptors")
      .select(studentCols)
      .limit(20000);
    if (error) throw error;

    const map = new Map<string, any>();
    for (const row of (data as any[]) || []) {
      const sid = row.student_id;
      const s = row.students;
      const name = `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim();
      const cls = s.classrooms ? `${s.classrooms.grade_level || ""}/${s.classrooms.name || ""}` : "-";
      const code = s.student_code || "";
      const existing = map.get(sid);
      if (existing) {
        existing.descriptors.push(row.descriptor as number[]);
        if (withImages && row.face_image && existing.images.length < MAX_IMAGES_PER_PERSON) existing.images.push(row.face_image);
      } else {
        map.set(sid, {
          studentId: sid, studentCode: code, name, classroom: cls,
          descriptors: [row.descriptor as number[]],
          images: withImages && row.face_image ? [row.face_image] : [],
          isStaff: false,
        });
      }
    }

    // ── บุคลากร ──
    if (withStaff) {
      try {
        const staffCols =
          "personnel_id, descriptor" + (withImages ? ", face_image" : "") +
          ", personnel!inner(id, prefix, first_name, last_name, employee_code, position)";
        const { data: pData, error: pErr } = await (admin as any)
          .from("personnel_face_descriptors").select(staffCols).limit(20000);
        if (pErr) throw pErr;
        for (const row of (pData as any[]) || []) {
          const pid = row.personnel_id;
          const p = row.personnel;
          const key = `staff:${pid}`;
          const existing = map.get(key);
          if (existing) {
            existing.descriptors.push(row.descriptor as number[]);
            if (withImages && row.face_image && existing.images.length < MAX_IMAGES_PER_PERSON) existing.images.push(row.face_image);
          } else {
            map.set(key, {
              studentId: pid,
              studentCode: p.employee_code || "",
              name: `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim(),
              classroom: p.position || "บุคลากร",
              descriptors: [row.descriptor as number[]],
              images: withImages && row.face_image ? [row.face_image] : [],
              isStaff: true,
            });
          }
        }
      } catch (e) {
        console.warn("staff descriptors skipped:", (e as any)?.message);
      }
    }

    const faces = Array.from(map.values());
    const version = await buildVersion();
    return new Response(JSON.stringify({ faces, count: faces.length, ...version }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
