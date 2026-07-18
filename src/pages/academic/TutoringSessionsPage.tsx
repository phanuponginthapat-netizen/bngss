import { SimpleCrudPage, statusBadge, moneyTH } from "@/components/generic/SimpleCrudPage";
import { GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function TutoringSessionsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  return (
    <SimpleCrudPage
      title="ติว / สอนเสริม"
      subtitle="ครูเปิดคิวติว นักเรียนจองคิวได้ทั้งออนไลน์และที่โรงเรียน"
      icon={GraduationCap}
      table="tutoring_sessions"
      searchableFields={["subject_name", "topic", "location"]}
      orderBy="start_time"
      ascending={true}
      fields={[
        { name: "subject_name", label: "วิชา", required: true },
        { name: "topic", label: "หัวข้อติว", required: true },
        { name: "start_time", label: "เริ่ม", type: "datetime-local", required: true },
        { name: "end_time", label: "สิ้นสุด", type: "datetime-local", required: true },
        { name: "location", label: "สถานที่", placeholder: "เช่น ห้องสมุด ชั้น 2" },
        { name: "online_url", label: "ลิงก์ออนไลน์ (ถ้ามี)" },
        { name: "capacity", label: "จำนวนรับ", type: "number", defaultValue: 20, required: true },
        { name: "is_free", label: "ฟรี", type: "checkbox", defaultValue: true },
        { name: "fee", label: "ค่าธรรมเนียม (บาท)", type: "number", defaultValue: 0 },
        { name: "status", label: "สถานะ", type: "select", defaultValue: "open",
          options: [
            { value: "open", label: "เปิดรับ" },
            { value: "full", label: "เต็ม" },
            { value: "cancelled", label: "ยกเลิก" },
            { value: "completed", label: "เสร็จสิ้น" },
          ]},
        { name: "description", label: "คำอธิบาย", type: "textarea" },
      ]}
      beforeInsert={(v) => ({ ...v, teacher_id: userId })}
      columns={[
        { key: "subject_name", label: "วิชา" },
        { key: "topic", label: "หัวข้อ" },
        { key: "start_time", label: "เริ่ม", render: v => v ? new Date(v).toLocaleString("th-TH") : "—" },
        { key: "location", label: "สถานที่" },
        { key: "booked_count", label: "จองแล้ว", render: (v, r) => `${v}/${r.capacity}` },
        { key: "fee", label: "ค่าใช้จ่าย", render: (v, r) => r.is_free ? "ฟรี" : moneyTH(v) },
        { key: "status", label: "สถานะ", render: v => statusBadge(v, {
          open: { label: "เปิด", variant: "default" },
          full: { label: "เต็ม", variant: "secondary" },
          cancelled: { label: "ยกเลิก", variant: "destructive" },
          completed: { label: "เสร็จ", variant: "outline" },
        })},
      ]}
    />
  );
}
