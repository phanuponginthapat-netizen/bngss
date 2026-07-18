import { SimpleCrudPage, statusBadge } from "@/components/generic/SimpleCrudPage";
import { ShieldCheck } from "lucide-react";

export default function SarEvidencesPage() {
  return (
    <SimpleCrudPage
      title="SAR — หลักฐานประกันคุณภาพ"
      subtitle="เก็บหลักฐาน 3 มาตรฐาน OBEC สำหรับรายงานประจำปี"
      icon={ShieldCheck}
      table="sar_evidences"
      searchableFields={["indicator_name", "evidence_title", "description"]}
      fields={[
        { name: "academic_year", label: "ปีการศึกษา", required: true, placeholder: "2568" },
        { name: "standard_no", label: "มาตรฐานที่", type: "select", required: true,
          options: [
            { value: "1", label: "มาตรฐานที่ 1 — คุณภาพผู้เรียน" },
            { value: "2", label: "มาตรฐานที่ 2 — กระบวนการบริหาร" },
            { value: "3", label: "มาตรฐานที่ 3 — กระบวนการจัดการเรียนการสอน" },
          ]},
        { name: "indicator_no", label: "ตัวชี้วัดที่", required: true, placeholder: "1.1, 2.3" },
        { name: "indicator_name", label: "ชื่อตัวชี้วัด", required: true },
        { name: "evidence_title", label: "ชื่อหลักฐาน", required: true },
        { name: "evidence_url", label: "ไฟล์หลักฐาน (รูป/PDF)", type: "file", bucket: "sar-evidences", accept: "image/*,application/pdf" },
        { name: "quality_level", label: "ระดับคุณภาพ", type: "select",
          options: [
            { value: "excellent", label: "ยอดเยี่ยม" },
            { value: "very_good", label: "ดีเลิศ" },
            { value: "good", label: "ดี" },
            { value: "fair", label: "ปานกลาง" },
            { value: "need_improve", label: "ต้องปรับปรุง" },
          ]},
        { name: "description", label: "รายละเอียด", type: "textarea" },
      ]}
      columns={[
        { key: "academic_year", label: "ปี" },
        { key: "standard_no", label: "มาตรฐาน" },
        { key: "indicator_no", label: "ตัวชี้วัด" },
        { key: "evidence_title", label: "หลักฐาน" },
        { key: "quality_level", label: "ระดับ", render: v => v ? statusBadge(v, {
          excellent: { label: "ยอดเยี่ยม", variant: "default" },
          very_good: { label: "ดีเลิศ", variant: "default" },
          good: { label: "ดี", variant: "secondary" },
          fair: { label: "ปานกลาง", variant: "outline" },
          need_improve: { label: "ปรับปรุง", variant: "destructive" },
        }) : "—" },
      ]}
    />
  );
}
