import { SimpleCrudPage, statusBadge } from "@/components/generic/SimpleCrudPage";
import { FileText } from "lucide-react";

export default function MouRecordsPage() {
  return (
    <SimpleCrudPage
      title="MOU / ความร่วมมือ"
      subtitle="บันทึกความร่วมมือกับหน่วยงานภายนอก"
      icon={FileText}
      table="mou_records"
      searchableFields={["title", "partner_name", "subject"]}
      fields={[
        { name: "title", label: "ชื่อ MOU", required: true },
        { name: "partner_name", label: "หน่วยงานคู่สัญญา", required: true },
        { name: "partner_contact", label: "ผู้ติดต่อ" },
        { name: "subject", label: "เรื่อง" },
        { name: "scope", label: "ขอบเขตความร่วมมือ", type: "textarea" },
        { name: "start_date", label: "เริ่มใช้", type: "date", required: true },
        { name: "end_date", label: "สิ้นสุด", type: "date" },
        { name: "status", label: "สถานะ", type: "select", defaultValue: "active",
          options: [
            { value: "draft", label: "ร่าง" },
            { value: "active", label: "ใช้งาน" },
            { value: "expired", label: "หมดอายุ" },
            { value: "terminated", label: "ยกเลิก" },
          ]},
        { name: "file_url", label: "ไฟล์ MOU (PDF/รูป)", type: "file", bucket: "mou-files", accept: ".pdf,image/*" },
        { name: "notes", label: "หมายเหตุ", type: "textarea" },
      ]}
      columns={[
        { key: "title", label: "ชื่อ MOU" },
        { key: "partner_name", label: "คู่สัญญา" },
        { key: "start_date", label: "เริ่ม" },
        { key: "end_date", label: "สิ้นสุด" },
        { key: "status", label: "สถานะ", render: v => statusBadge(v, {
          draft: { label: "ร่าง", variant: "outline" },
          active: { label: "ใช้งาน", variant: "default" },
          expired: { label: "หมดอายุ", variant: "secondary" },
          terminated: { label: "ยกเลิก", variant: "destructive" },
        })},
      ]}
    />
  );
}
