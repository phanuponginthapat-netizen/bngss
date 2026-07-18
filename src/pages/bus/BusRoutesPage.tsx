import { SimpleCrudPage, moneyTH } from "@/components/generic/SimpleCrudPage";
import { Bus } from "lucide-react";

export default function BusRoutesPage() {
  return (
    <SimpleCrudPage
      title="รถรับ-ส่งนักเรียน — เส้นทาง"
      subtitle="กำหนดสาย คนขับ ทะเบียนรถ และค่าบริการรายเดือน"
      icon={Bus}
      table="bus_routes"
      searchableFields={["name", "code", "vehicle_plate"]}
      fields={[
        { name: "name", label: "ชื่อเส้นทาง", required: true, placeholder: "เช่น สาย A - บ้านห้วยขวาง" },
        { name: "code", label: "รหัสสาย", placeholder: "A" },
        { name: "vehicle_plate", label: "ทะเบียนรถ" },
        { name: "vehicle_color", label: "สีรถ" },
        { name: "capacity", label: "ความจุ (คน)", type: "number" },
        { name: "monthly_fee", label: "ค่าบริการ/เดือน (บาท)", type: "number", defaultValue: 0 },
        { name: "is_active", label: "เปิดให้บริการ", type: "checkbox", defaultValue: true },
      ]}
      columns={[
        { key: "code", label: "สาย" },
        { key: "name", label: "ชื่อเส้นทาง" },
        { key: "vehicle_plate", label: "ทะเบียนรถ" },
        { key: "capacity", label: "ความจุ" },
        { key: "monthly_fee", label: "ค่าบริการ", render: v => moneyTH(v) },
        { key: "is_active", label: "เปิด", render: v => v ? "✅" : "—" },
      ]}
    />
  );
}
