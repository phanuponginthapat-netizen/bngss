import { SimpleCrudPage } from "@/components/generic/SimpleCrudPage";
import { UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function VisitorLogsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  return (
    <SimpleCrudPage
      title="บันทึกผู้มาติดต่อ (Visitor)"
      subtitle="ลงทะเบียนผู้มาติดต่อ ออกบัตร และบันทึกเวลาเข้า-ออก"
      icon={UserCheck}
      table="visitor_logs"
      searchableFields={["visitor_name", "visitor_phone", "organization", "badge_no"]}
      orderBy="check_in"
      fields={[
        { name: "visitor_name", label: "ชื่อ-สกุล ผู้มาติดต่อ", required: true },
        { name: "visitor_phone", label: "เบอร์โทร" },
        { name: "id_card_last4", label: "เลขบัตร ปชช. 4 ตัวท้าย", placeholder: "1234" },
        { name: "organization", label: "หน่วยงาน" },
        { name: "purpose", label: "วัตถุประสงค์", required: true, type: "textarea" },
        { name: "contact_person_name", label: "ผู้ติดต่อภายใน" },
        { name: "badge_no", label: "หมายเลขบัตรเข้า" },
        { name: "vehicle_plate", label: "ทะเบียนรถ" },
        { name: "check_in", label: "เวลาเข้า", type: "datetime-local" },
        { name: "check_out", label: "เวลาออก (เว้นว่างถ้ายังอยู่)", type: "datetime-local" },
        { name: "photo_url", label: "ภาพถ่ายผู้มาติดต่อ", type: "image", folder: "visitors" },
        { name: "notes", label: "หมายเหตุ", type: "textarea" },
      ]}
      beforeInsert={(v) => ({ ...v, recorded_by: userId })}
      columns={[
        { key: "visitor_name", label: "ชื่อ" },
        { key: "organization", label: "หน่วยงาน" },
        { key: "badge_no", label: "บัตร" },
        { key: "purpose", label: "วัตถุประสงค์", render: v => <span className="line-clamp-2">{v}</span> },
        { key: "check_in", label: "เข้า", render: v => v ? new Date(v).toLocaleString("th-TH") : "—" },
        { key: "check_out", label: "ออก", render: v => v ? new Date(v).toLocaleString("th-TH") : "🟢 อยู่ในพื้นที่" },
      ]}
    />
  );
}
