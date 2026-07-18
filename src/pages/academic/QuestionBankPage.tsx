import { SimpleCrudPage, statusBadge } from "@/components/generic/SimpleCrudPage";
import { BookOpenCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function QuestionBankPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  return (
    <SimpleCrudPage
      title="คลังข้อสอบกลาง"
      subtitle="เก็บข้อสอบให้ครูในระบบเลือกใช้ — แชร์ระหว่างครู, สุ่มข้อสอบ"
      icon={BookOpenCheck}
      table="question_bank"
      searchableFields={["question", "topic", "subject_name", "grade_level"]}
      fields={[
        { name: "subject_name", label: "วิชา", required: true },
        { name: "grade_level", label: "ระดับชั้น", placeholder: "ป.6, ม.3" },
        { name: "topic", label: "หัวข้อ/บท" },
        { name: "difficulty", label: "ระดับความยาก", type: "select", defaultValue: "medium",
          options: [
            { value: "easy", label: "ง่าย" }, { value: "medium", label: "ปานกลาง" }, { value: "hard", label: "ยาก" },
          ]},
        { name: "question_type", label: "ประเภท", type: "select", defaultValue: "mcq",
          options: [
            { value: "mcq", label: "ปรนัย 4 ตัวเลือก" },
            { value: "tf", label: "ถูก/ผิด" },
            { value: "short", label: "ตอบสั้น" },
            { value: "essay", label: "อัตนัย" },
            { value: "fill", label: "เติมคำ" },
          ]},
        { name: "question", label: "คำถาม", type: "textarea", required: true },
        { name: "correct_answer", label: "เฉลย" },
        { name: "explanation", label: "คำอธิบาย/เหตุผล", type: "textarea" },
        { name: "bloom_level", label: "Bloom Level", placeholder: "remember/understand/apply..." },
        { name: "is_public", label: "แชร์ให้ครูคนอื่นใช้", type: "checkbox", defaultValue: true },
      ]}
      beforeInsert={(v) => ({ ...v, owner_id: userId })}
      columns={[
        { key: "subject_name", label: "วิชา" },
        { key: "grade_level", label: "ระดับ" },
        { key: "topic", label: "หัวข้อ" },
        { key: "difficulty", label: "ยาก-ง่าย", render: v => statusBadge(v, {
          easy: { label: "ง่าย", variant: "default" },
          medium: { label: "ปานกลาง", variant: "secondary" },
          hard: { label: "ยาก", variant: "destructive" },
        })},
        { key: "question", label: "คำถาม", render: v => <span className="line-clamp-2">{v}</span> },
        { key: "usage_count", label: "ใช้ไป" },
      ]}
    />
  );
}
