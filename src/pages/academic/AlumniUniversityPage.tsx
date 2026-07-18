import { SimpleCrudPage } from "@/components/generic/SimpleCrudPage";
import { Building2 } from "lucide-react";

export default function AlumniUniversityPage() {
  return (
    <SimpleCrudPage
      title="ติดตามศิษย์เก่า — มหาวิทยาลัย"
      subtitle="บันทึกข้อมูลศิษย์เก่าที่ศึกษาต่อ พร้อมข้อมูลการทำงาน"
      icon={Building2}
      table="alumni_university"
      searchableFields={["university", "faculty", "major", "current_company"]}
      orderBy="graduation_year"
      fields={[
        { name: "graduation_year", label: "ปีที่จบ", type: "number", required: true, placeholder: "เช่น 2566" },
        { name: "university", label: "มหาวิทยาลัย", required: true },
        { name: "faculty", label: "คณะ" },
        { name: "major", label: "สาขา" },
        { name: "degree", label: "วุฒิ", placeholder: "ปริญญาตรี/โท/เอก" },
        { name: "current_position", label: "ตำแหน่งปัจจุบัน" },
        { name: "current_company", label: "บริษัท/หน่วยงาน" },
        { name: "is_employed", label: "ทำงานแล้ว", type: "checkbox" },
        { name: "contact_email", label: "อีเมล" },
        { name: "contact_phone", label: "โทรศัพท์" },
        { name: "notes", label: "หมายเหตุ", type: "textarea" },
      ]}
      columns={[
        { key: "graduation_year", label: "ปีจบ" },
        { key: "university", label: "มหาวิทยาลัย" },
        { key: "faculty", label: "คณะ" },
        { key: "major", label: "สาขา" },
        { key: "current_position", label: "ตำแหน่งงาน" },
      ]}
    />
  );
}
