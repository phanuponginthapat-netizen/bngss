import { SimpleCrudPage, statusBadge } from "@/components/generic/SimpleCrudPage";
import { DoorOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function RoomBookingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  return (
    <SimpleCrudPage
      title="จองห้องประชุม / ห้องพิเศษ"
      subtitle="จองห้องล่วงหน้า รออนุมัติ พร้อมจัดการอุปกรณ์"
      icon={DoorOpen}
      table="room_bookings"
      searchableFields={["room_name", "purpose"]}
      orderBy="start_time"
      ascending={true}
      fields={[
        { name: "room_name", label: "ชื่อห้อง", required: true, placeholder: "เช่น ห้องประชุม 1" },
        { name: "start_time", label: "เริ่ม", type: "datetime-local", required: true },
        { name: "end_time", label: "สิ้นสุด", type: "datetime-local", required: true },
        { name: "purpose", label: "วัตถุประสงค์", required: true, type: "textarea" },
        { name: "attendees_count", label: "จำนวนผู้เข้าร่วม", type: "number" },
        { name: "equipment_needed", label: "อุปกรณ์ที่ต้องการ", placeholder: "โปรเจคเตอร์, ไมค์" },
        { name: "status", label: "สถานะ", type: "select", defaultValue: "pending",
          options: [
            { value: "pending", label: "รออนุมัติ" }, { value: "approved", label: "อนุมัติ" },
            { value: "rejected", label: "ไม่อนุมัติ" }, { value: "cancelled", label: "ยกเลิก" },
          ]},
      ]}
      beforeInsert={(v) => ({ ...v, booked_by: userId })}
      columns={[
        { key: "room_name", label: "ห้อง" },
        { key: "start_time", label: "เริ่ม", render: v => v ? new Date(v).toLocaleString("th-TH") : "—" },
        { key: "end_time", label: "สิ้นสุด", render: v => v ? new Date(v).toLocaleString("th-TH") : "—" },
        { key: "purpose", label: "วัตถุประสงค์", render: v => <span className="line-clamp-2">{v}</span> },
        { key: "status", label: "สถานะ", render: v => statusBadge(v, {
          pending: { label: "รออนุมัติ", variant: "secondary" },
          approved: { label: "อนุมัติ", variant: "default" },
          rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
          cancelled: { label: "ยกเลิก", variant: "outline" },
        })},
      ]}
    />
  );
}
