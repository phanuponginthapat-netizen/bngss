import { SimpleCrudPage, statusBadge, moneyTH } from "@/components/generic/SimpleCrudPage";
import { BookOpen } from "lucide-react";

export default function LibraryLoansPage() {
  return (
    <SimpleCrudPage
      title="ห้องสมุด — ยืม-คืนหนังสือ"
      subtitle="บันทึกการยืม คำนวณค่าปรับ และติดตามหนังสือคืน"
      icon={BookOpen}
      table="library_loans"
      searchableFields={["notes"]}
      fields={[
        { name: "book_id", label: "รหัสหนังสือ (UUID)", required: true },
        { name: "borrower_user_id", label: "รหัสผู้ยืม (UUID user)" },
        { name: "borrower_student_id", label: "รหัสนักเรียนที่ยืม (UUID student)" },
        { name: "loaned_at", label: "ยืมเมื่อ", type: "datetime-local", required: true },
        { name: "due_at", label: "กำหนดคืน", type: "datetime-local", required: true },
        { name: "returned_at", label: "คืนเมื่อ (เว้นว่างถ้ายังไม่คืน)", type: "datetime-local" },
        { name: "fine_amount", label: "ค่าปรับ (บาท)", type: "number", defaultValue: 0 },
        { name: "fine_paid", label: "ชำระค่าปรับแล้ว", type: "checkbox" },
        { name: "notes", label: "หมายเหตุ", type: "textarea" },
      ]}
      columns={[
        { key: "book_id", label: "รหัสหนังสือ" },
        { key: "loaned_at", label: "ยืมเมื่อ", render: v => v ? new Date(v).toLocaleString("th-TH") : "—" },
        { key: "due_at", label: "กำหนดคืน", render: v => v ? new Date(v).toLocaleDateString("th-TH") : "—" },
        { key: "returned_at", label: "สถานะ", render: v => v
          ? statusBadge("returned", { returned: { label: "คืนแล้ว", variant: "default" } })
          : statusBadge("borrowed", { borrowed: { label: "ยังไม่คืน", variant: "secondary" } }) },
        { key: "fine_amount", label: "ค่าปรับ", render: v => moneyTH(v) },
      ]}
    />
  );
}
