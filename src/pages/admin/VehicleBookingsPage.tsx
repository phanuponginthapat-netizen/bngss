import { SimpleCrudPage, statusBadge, moneyTH } from "@/components/generic/SimpleCrudPage";
import { Car } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function VehicleBookingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  return (
    <SimpleCrudPage
      title="จองรถยนต์ส่วนกลาง"
      subtitle="ขออนุมัติใช้รถยนต์ของโรงเรียน พร้อมบันทึกระยะทาง-น้ำมัน"
      icon={Car}
      table="vehicle_bookings"
      searchableFields={["vehicle_name", "destination", "purpose"]}
      orderBy="start_time"
      ascending={true}
      fields={[
        { name: "vehicle_name", label: "ชื่อรถ/ประเภท", required: true, placeholder: "เช่น Toyota Hilux สีขาว" },
        { name: "vehicle_plate", label: "ทะเบียน" },
        { name: "start_time", label: "ออกเดินทาง", type: "datetime-local", required: true },
        { name: "end_time", label: "กลับถึง", type: "datetime-local", required: true },
        { name: "destination", label: "จุดหมาย", required: true },
        { name: "purpose", label: "ภารกิจ", required: true, type: "textarea" },
        { name: "driver_name", label: "ชื่อพนักงานขับรถ" },
        { name: "passengers_count", label: "จำนวนผู้โดยสาร", type: "number" },
        { name: "status", label: "สถานะ", type: "select", defaultValue: "pending",
          options: [
            { value: "pending", label: "รออนุมัติ" }, { value: "approved", label: "อนุมัติ" },
            { value: "rejected", label: "ไม่อนุมัติ" }, { value: "in_use", label: "กำลังใช้" },
            { value: "completed", label: "เสร็จสิ้น" }, { value: "cancelled", label: "ยกเลิก" },
          ]},
        { name: "odometer_start", label: "เลขไมล์เริ่ม", type: "number" },
        { name: "odometer_end", label: "เลขไมล์สิ้นสุด", type: "number" },
        { name: "fuel_cost", label: "ค่าน้ำมัน (บาท)", type: "number" },
      ]}
      beforeInsert={(v) => ({ ...v, booked_by: userId })}
      columns={[
        { key: "vehicle_name", label: "รถ" },
        { key: "start_time", label: "ออก", render: v => v ? new Date(v).toLocaleString("th-TH") : "—" },
        { key: "destination", label: "จุดหมาย" },
        { key: "purpose", label: "ภารกิจ", render: v => <span className="line-clamp-2">{v}</span> },
        { key: "fuel_cost", label: "ค่าน้ำมัน", render: v => moneyTH(v) },
        { key: "status", label: "สถานะ", render: v => statusBadge(v, {
          pending: { label: "รออนุมัติ", variant: "secondary" },
          approved: { label: "อนุมัติ", variant: "default" },
          rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
          in_use: { label: "ใช้อยู่", variant: "default" },
          completed: { label: "เสร็จ", variant: "outline" },
          cancelled: { label: "ยกเลิก", variant: "outline" },
        })},
      ]}
    />
  );
}
