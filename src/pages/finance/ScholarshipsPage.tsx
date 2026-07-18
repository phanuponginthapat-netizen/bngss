import { SimpleCrudPage, statusBadge, moneyTH } from "@/components/generic/SimpleCrudPage";
import { Award } from "lucide-react";

export default function ScholarshipsPage() {
  return (
    <SimpleCrudPage
      title="ทุนการศึกษา / กยศ."
      subtitle="กำหนดประเภททุน วงเงิน เกณฑ์การได้รับ และช่วงเวลาสมัคร"
      icon={Award}
      table="scholarships"
      searchableFields={["name", "criteria"]}
      fields={[
        { name: "name", label: "ชื่อทุน", required: true },
        { name: "type", label: "ประเภท", type: "select", defaultValue: "general",
          options: [
            { value: "general", label: "ทุนทั่วไป" },
            { value: "kyoso", label: "กยศ." },
            { value: "poor", label: "ทุนยากจน" },
            { value: "talent", label: "ทุนความสามารถ" },
            { value: "sports", label: "ทุนกีฬา" },
            { value: "academic", label: "ทุนการเรียน" },
            { value: "other", label: "อื่นๆ" },
          ]},
        { name: "amount_per_award", label: "วงเงินต่อทุน (บาท)", type: "number", required: true },
        { name: "total_budget", label: "งบประมาณรวม (บาท)", type: "number" },
        { name: "quota", label: "จำนวนทุน", type: "number" },
        { name: "academic_year", label: "ปีการศึกษา" },
        { name: "apply_start", label: "เปิดรับสมัคร", type: "date" },
        { name: "apply_end", label: "ปิดรับสมัคร", type: "date" },
        { name: "status", label: "สถานะ", type: "select", defaultValue: "open",
          options: [
            { value: "draft", label: "ร่าง" },
            { value: "open", label: "เปิดรับ" },
            { value: "closed", label: "ปิดรับ" },
            { value: "archived", label: "เก็บถาวร" },
          ]},
        { name: "criteria", label: "เกณฑ์การได้รับ", type: "textarea" },
      ]}
      columns={[
        { key: "name", label: "ชื่อทุน" },
        { key: "type", label: "ประเภท" },
        { key: "amount_per_award", label: "วงเงิน/ทุน", render: v => moneyTH(v) },
        { key: "quota", label: "จำนวน" },
        { key: "academic_year", label: "ปีการศึกษา" },
        { key: "status", label: "สถานะ", render: v => statusBadge(v, {
          draft: { label: "ร่าง", variant: "outline" },
          open: { label: "เปิดรับ", variant: "default" },
          closed: { label: "ปิดรับ", variant: "secondary" },
          archived: { label: "ถาวร", variant: "outline" },
        })},
      ]}
    />
  );
}
