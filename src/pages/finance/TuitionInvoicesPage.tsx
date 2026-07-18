import { SimpleCrudPage, statusBadge, moneyTH } from "@/components/generic/SimpleCrudPage";
import { DollarSign } from "lucide-react";

export default function TuitionInvoicesPage() {
  return (
    <SimpleCrudPage
      title="ใบเรียกเก็บค่าเทอม / ค่ากิจกรรม"
      subtitle="ออกใบแจ้งหนี้ ติดตามการชำระ และดูสถานะค้างจ่าย"
      icon={DollarSign}
      table="tuition_invoices"
      searchableFields={["invoice_no", "title", "description"]}
      fields={[
        { name: "student_id", label: "รหัสนักเรียน (UUID)", required: true, placeholder: "เลือกจากตาราง students" },
        { name: "title", label: "ชื่อรายการ", required: true, placeholder: "เช่น ค่าเทอม 1/2568" },
        { name: "amount", label: "จำนวนเงิน (บาท)", type: "number", required: true },
        { name: "due_date", label: "กำหนดชำระ", type: "date", required: true },
        { name: "academic_year", label: "ปีการศึกษา", placeholder: "เช่น 2568" },
        { name: "semester", label: "ภาคเรียน", type: "number" },
        { name: "status", label: "สถานะ", type: "select", defaultValue: "pending",
          options: [
            { value: "pending", label: "รอชำระ" },
            { value: "paid", label: "ชำระแล้ว" },
            { value: "overdue", label: "เกินกำหนด" },
            { value: "cancelled", label: "ยกเลิก" },
            { value: "refunded", label: "คืนเงิน" },
          ] },
        { name: "payment_method", label: "วิธีชำระ", placeholder: "PromptPay/โอน/เงินสด" },
        { name: "qr_payload", label: "QR PromptPay (payload)", placeholder: "00020101..." },
        { name: "description", label: "รายละเอียด", type: "textarea" },
      ]}
      columns={[
        { key: "invoice_no", label: "เลขที่" },
        { key: "title", label: "รายการ" },
        { key: "amount", label: "จำนวน", render: v => moneyTH(v) },
        { key: "due_date", label: "กำหนดชำระ" },
        { key: "status", label: "สถานะ", render: v => statusBadge(v, {
          pending: { label: "รอชำระ", variant: "secondary" },
          paid: { label: "ชำระแล้ว", variant: "default" },
          overdue: { label: "เกินกำหนด", variant: "destructive" },
          cancelled: { label: "ยกเลิก", variant: "outline" },
          refunded: { label: "คืนเงิน", variant: "outline" },
        }) },
      ]}
    />
  );
}
