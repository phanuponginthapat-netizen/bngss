import { SimpleCrudPage, statusBadge } from "@/components/generic/SimpleCrudPage";
import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function PdpaRequestsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  return (
    <SimpleCrudPage
      title="คำขอ PDPA (สิทธิเจ้าของข้อมูล)"
      subtitle="ยื่นคำขอเข้าถึง แก้ไข ลบ หรือถอนความยินยอมข้อมูลส่วนบุคคล"
      icon={ShieldAlert}
      table="pdpa_requests"
      searchableFields={["details", "response_notes"]}
      fields={[
        { name: "request_type", label: "ประเภทคำขอ", type: "select", required: true,
          options: [
            { value: "access", label: "ขอเข้าถึงข้อมูล" },
            { value: "correct", label: "ขอแก้ไขข้อมูล" },
            { value: "delete", label: "ขอลบข้อมูล" },
            { value: "export", label: "ขอสำเนาข้อมูล (Export)" },
            { value: "restrict", label: "ขอจำกัดการใช้ข้อมูล" },
            { value: "withdraw_consent", label: "ขอถอนความยินยอม" },
          ]},
        { name: "details", label: "รายละเอียดคำขอ", type: "textarea", required: true },
        { name: "status", label: "สถานะ (เจ้าหน้าที่)", type: "select", defaultValue: "pending",
          options: [
            { value: "pending", label: "รอพิจารณา" },
            { value: "reviewing", label: "กำลังตรวจสอบ" },
            { value: "approved", label: "อนุมัติ" },
            { value: "rejected", label: "ปฏิเสธ" },
            { value: "completed", label: "ดำเนินการเสร็จ" },
          ]},
        { name: "response_notes", label: "บันทึกคำตอบ", type: "textarea" },
      ]}
      beforeInsert={(v) => ({ ...v, user_id: userId })}
      columns={[
        { key: "request_type", label: "ประเภท", render: v => ({
          access: "เข้าถึง", correct: "แก้ไข", delete: "ลบ", export: "Export",
          restrict: "จำกัด", withdraw_consent: "ถอนยินยอม"
        } as any)[v] || v },
        { key: "details", label: "รายละเอียด", render: v => <span className="line-clamp-2">{v}</span> },
        { key: "status", label: "สถานะ", render: v => statusBadge(v, {
          pending: { label: "รอ", variant: "secondary" },
          reviewing: { label: "ตรวจสอบ", variant: "secondary" },
          approved: { label: "อนุมัติ", variant: "default" },
          rejected: { label: "ปฏิเสธ", variant: "destructive" },
          completed: { label: "เสร็จ", variant: "default" },
        })},
        { key: "created_at", label: "วันที่ยื่น", render: v => new Date(v).toLocaleDateString("th-TH") },
      ]}
    />
  );
}
