import { SimpleCrudPage, statusBadge } from "@/components/generic/SimpleCrudPage";
import { Inbox, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

async function openSarabanFile(path: string) {
  if (!path) return;
  const { data, error } = await supabase.storage.from("saraban-files").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) { toast.error("เปิดไฟล์ไม่ได้"); return; }
  window.open(data.signedUrl, "_blank");
}


export default function SarabanPage() {
  return (
    <SimpleCrudPage
      title="ระบบสารบรรณอิเล็กทรอนิกส์ (e-Saraban)"
      subtitle="ทะเบียนรับ-ส่งหนังสือราชการ"
      icon={Inbox}
      table="saraban_documents"
      searchableFields={["doc_no", "subject", "from_org", "to_dept"]}
      orderBy="doc_date"
      fields={[
        { name: "direction", label: "ทิศทาง", type: "select", required: true, defaultValue: "incoming",
          options: [
            { value: "incoming", label: "รับเข้า" },
            { value: "outgoing", label: "ส่งออก" },
            { value: "internal", label: "ภายใน" },
          ]},
        { name: "book_no", label: "เลขทะเบียน" },
        { name: "doc_no", label: "เลขหนังสือ", required: true },
        { name: "doc_date", label: "ลงวันที่", type: "date", required: true },
        { name: "received_date", label: "วันที่รับ/ส่ง", type: "date" },
        { name: "subject", label: "เรื่อง", required: true },
        { name: "from_org", label: "จาก (หน่วยงาน)" },
        { name: "to_dept", label: "ถึง (ฝ่าย/บุคคล)" },
        { name: "urgency", label: "ความเร่งด่วน", type: "select", defaultValue: "normal",
          options: [
            { value: "normal", label: "ปกติ" },
            { value: "urgent", label: "ด่วน" },
            { value: "very_urgent", label: "ด่วนมาก" },
            { value: "immediate", label: "ด่วนที่สุด" },
          ]},
        { name: "secrecy", label: "ชั้นความลับ", type: "select", defaultValue: "normal",
          options: [
            { value: "normal", label: "ปกติ" }, { value: "confidential", label: "ลับ" },
            { value: "secret", label: "ลับมาก" }, { value: "top_secret", label: "ลับที่สุด" },
          ]},
        { name: "status", label: "สถานะ", type: "select", defaultValue: "received",
          options: [
            { value: "received", label: "รับเรื่อง" }, { value: "assigned", label: "มอบหมาย" },
            { value: "in_progress", label: "ดำเนินการ" }, { value: "completed", label: "เสร็จ" },
            { value: "archived", label: "เก็บเข้าแฟ้ม" },
          ]},
        { name: "file_urls", label: "ไฟล์แนบ (แนบได้หลายไฟล์)", type: "files", bucket: "saraban-files", accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png" },
        { name: "notes", label: "หมายเหตุ", type: "textarea" },
      ]}
      columns={[
        { key: "doc_no", label: "เลขหนังสือ" },
        { key: "doc_date", label: "ลงวันที่" },
        { key: "direction", label: "ทิศทาง", render: v => statusBadge(v, {
          incoming: { label: "รับเข้า", variant: "default" },
          outgoing: { label: "ส่งออก", variant: "secondary" },
          internal: { label: "ภายใน", variant: "outline" },
        })},
        { key: "subject", label: "เรื่อง" },
        { key: "from_org", label: "จาก" },
        { key: "to_dept", label: "ถึง" },
        { key: "urgency", label: "เร่งด่วน" },
        { key: "status", label: "สถานะ" },
        { key: "file_urls", label: "ไฟล์แนบ", render: (v, row) => {
          const list: string[] = Array.isArray(v) && v.length ? v : (row?.file_url ? [row.file_url] : []);
          if (!list.length) return "—";
          return (
            <div className="flex flex-col gap-1">
              {list.map((p, i) => (
                <Button key={p + i} size="sm" variant="ghost" className="h-7 gap-1.5 justify-start" onClick={() => openSarabanFile(p)}>
                  <Paperclip className="w-3.5 h-3.5" /> ไฟล์ {i + 1}
                </Button>
              ))}
            </div>
          );
        } },
      ]}
    />
  );
}
