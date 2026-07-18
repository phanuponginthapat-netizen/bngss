import { SimpleCrudPage, moneyTH } from "@/components/generic/SimpleCrudPage";
import { UtensilsCrossed } from "lucide-react";

export default function CafeteriaMenusPage() {
  return (
    <SimpleCrudPage
      title="โรงอาหาร — เมนูประจำวัน"
      subtitle="ตั้งเมนู ราคา และความจุ ให้สั่งล่วงหน้าได้"
      icon={UtensilsCrossed}
      table="cafeteria_menus"
      searchableFields={["name", "description"]}
      orderBy="menu_date"
      fields={[
        { name: "menu_date", label: "วันที่", type: "date", required: true },
        { name: "meal_type", label: "มื้อ", type: "select", defaultValue: "lunch",
          options: [
            { value: "breakfast", label: "เช้า" },
            { value: "lunch", label: "กลางวัน" },
            { value: "snack", label: "ของว่าง" },
          ]},
        { name: "name", label: "ชื่อเมนู", required: true },
        { name: "price", label: "ราคา (บาท)", type: "number", defaultValue: 0 },
        { name: "capacity", label: "ความจุ (จาน)", type: "number" },
        { name: "image_url", label: "รูปอาหาร", type: "image", folder: "cafeteria" },
        { name: "is_active", label: "เปิดให้สั่ง", type: "checkbox", defaultValue: true },
        { name: "description", label: "รายละเอียด/แพ้อาหาร", type: "textarea" },
      ]}
      columns={[
        { key: "menu_date", label: "วันที่" },
        { key: "meal_type", label: "มื้อ" },
        { key: "name", label: "เมนู" },
        { key: "price", label: "ราคา", render: v => moneyTH(v) },
        { key: "ordered_count", label: "สั่งแล้ว", render: (v, r) => `${v}/${r.capacity ?? "∞"}` },
        { key: "is_active", label: "เปิด", render: v => v ? "✅" : "—" },
      ]}
    />
  );
}
