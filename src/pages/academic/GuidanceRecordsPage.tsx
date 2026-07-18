import { SimpleCrudPage, statusBadge } from "@/components/generic/SimpleCrudPage";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function GuidanceRecordsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  return (
    <SimpleCrudPage
      title="แนะแนว — บันทึกการให้คำปรึกษา"
      subtitle="บันทึกการให้คำปรึกษานักเรียน — career / personal / academic"
      icon={Heart}
      table="guidance_records"
      searchableFields={["topic", "notes"]}
      orderBy="session_date"
      fields={[
        { name: "student_id", label: "รหัสนักเรียน (UUID)", required: true },
        { name: "type", label: "ประเภทคำปรึกษา", type: "select", defaultValue: "general",
          options: [
            { value: "career", label: "ด้านอาชีพ" },
            { value: "personal", label: "ส่วนตัว" },
            { value: "academic", label: "การเรียน" },
            { value: "family", label: "ครอบครัว" },
            { value: "health", label: "สุขภาพ" },
            { value: "general", label: "ทั่วไป" },
          ]},
        { name: "session_date", label: "วันที่ให้คำปรึกษา", type: "date", required: true },
        { name: "topic", label: "หัวข้อ", required: true },
        { name: "notes", label: "บันทึกการให้คำปรึกษา", type: "textarea" },
        { name: "follow_up_at", label: "นัดติดตามวันที่", type: "date" },
        { name: "is_confidential", label: "ข้อมูลลับ (นักเรียนจะไม่เห็น)", type: "checkbox", defaultValue: true },
      ]}
      beforeInsert={(v) => ({ ...v, counselor_id: userId })}
      columns={[
        { key: "session_date", label: "วันที่" },
        { key: "type", label: "ประเภท" },
        { key: "topic", label: "หัวข้อ" },
        { key: "follow_up_at", label: "นัดติดตาม" },
        { key: "is_confidential", label: "ลับ", render: v => v ? "🔒" : "—" },
      ]}
    />
  );
}
