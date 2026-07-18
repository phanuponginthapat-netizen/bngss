import { SimpleCrudPage } from "@/components/generic/SimpleCrudPage";
import { BookOpen } from "lucide-react";

export default function LibraryBooksPage() {
  return (
    <SimpleCrudPage
      title="ห้องสมุด — คลังหนังสือ"
      subtitle="ทะเบียนหนังสือ บาร์โค้ด จำนวนเล่ม และที่จัดเก็บ"
      icon={BookOpen}
      table="library_books"
      searchableFields={["title", "author", "isbn", "barcode", "category"]}
      fields={[
        { name: "title", label: "ชื่อเรื่อง", required: true },
        { name: "author", label: "ผู้เขียน" },
        { name: "publisher", label: "สำนักพิมพ์" },
        { name: "category", label: "หมวดหมู่" },
        { name: "barcode", label: "บาร์โค้ด" },
        { name: "isbn", label: "ISBN" },
        { name: "language", label: "ภาษา", defaultValue: "th" },
        { name: "copies_total", label: "จำนวนเล่มทั้งหมด", type: "number", defaultValue: 1, required: true },
        { name: "copies_available", label: "จำนวนเล่มว่าง", type: "number", defaultValue: 1, required: true },
        { name: "location", label: "ตำแหน่งจัดเก็บ", placeholder: "ชั้น/ตู้" },
        { name: "cover_url", label: "ปกหนังสือ", type: "image", folder: "library" },
        { name: "description", label: "เรื่องย่อ", type: "textarea" },
      ]}
      columns={[
        { key: "barcode", label: "บาร์โค้ด" },
        { key: "title", label: "ชื่อเรื่อง" },
        { key: "author", label: "ผู้เขียน" },
        { key: "category", label: "หมวด" },
        { key: "copies_available", label: "ว่าง", render: (v, r) => `${v}/${r.copies_total}` },
        { key: "location", label: "ที่เก็บ" },
      ]}
    />
  );
}
