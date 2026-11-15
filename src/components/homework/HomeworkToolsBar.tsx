import { Link } from "react-router-dom";
import { FileText, Sheet, Presentation, FileType2, FolderOpen, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

// เครื่องมือส่วนกลางของระบบที่เปิดได้จากหน้าการบ้าน — ใช้เส้นทางเดิมที่มีสิทธิ์ตรวจอยู่แล้ว
const TOOLS = [
  { to: "/dashboard/office/docs", label: "เอกสาร", icon: FileText },
  { to: "/dashboard/office/sheets", label: "ตาราง", icon: Sheet },
  { to: "/dashboard/office/slides", label: "สไลด์", icon: Presentation },
  { to: "/dashboard/office/pdf", label: "PDF", icon: FileType2 },
  { to: "/dashboard/my-drive", label: "Google Drive", icon: FolderOpen },
  { to: "/dashboard/browser", label: "เว็บเบราว์เซอร์", icon: Globe },
];

export default function HomeworkToolsBar({ compact = false, title = "เครื่องมือ" }: { compact?: boolean; title?: string }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`font-medium text-muted-foreground ${compact ? "text-[11px]" : "text-xs"}`}>{title}:</span>
      {TOOLS.map(({ to, label, icon: Icon }) => (
        <Button key={to} asChild size="sm" variant="outline" className={compact ? "h-7 px-2 text-xs" : "h-8"}>
          <Link to={to}><Icon className="w-3.5 h-3.5 mr-1" />{label}</Link>
        </Button>
      ))}
    </div>
  );
}
