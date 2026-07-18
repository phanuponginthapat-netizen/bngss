import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, FileCode, Printer, FileEdit } from "lucide-react";
import EditBeforeExportDialog from "@/components/editor/EditBeforeExportDialog";
import FormTemplateButton from "@/components/academic/FormTemplateButton";

export interface ExportMenuAction {
  key: string;
  label: string;
  icon?: "pdf" | "xlsx" | "xml" | "print";
  onClick: () => void | Promise<void>;
}

interface ExportMenuProps {
  actions: ExportMenuAction[];
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
  /** ถ้ากำหนด จะมีเมนู "แก้ไขก่อนส่งออก" — เปิด Word-like editor ก่อน Print/Export */
  editableHtml?: () => string | Promise<string>;
  editableTitle?: string;
  editableFilename?: string;
  /** ถ้ากำหนด จะแสดงปุ่ม "ดูตัวอย่างฟอร์ม" ข้างปุ่ม Export — admin/director แก้ไข template กลางได้ */
  templateCode?: string;
  templateTitle?: string;
  templateDefaultHtml?: string;
}


const iconFor = (k?: string) => {
  const cls = "w-4 h-4 mr-2";
  switch (k) {
    case "pdf": return <FileText className={cls} />;
    case "xlsx": return <FileSpreadsheet className={cls} />;
    case "xml": return <FileCode className={cls} />;
    case "print": return <Printer className={cls} />;
    default: return <Download className={cls} />;
  }
};

/**
 * ปุ่ม Export รวมศูนย์ — ใช้กับทุกฟอร์ม ปพ.
 * รองรับ PDF / Excel SGS / Excel SchoolMIS / DMC XML / CSV + "แก้ไขก่อนส่งออก" (Word-like)
 */
export const ExportMenu = ({ actions, label = "ส่งออก", size = "sm", variant = "outline", editableHtml, editableTitle, editableFilename, templateCode, templateTitle, templateDefaultHtml }: ExportMenuProps) => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorHtml, setEditorHtml] = useState("");

  const openEditor = async () => {
    if (!editableHtml) return;
    const h = await editableHtml();
    setEditorHtml(h || "<p></p>");
    setEditorOpen(true);
  };

  if (!actions.length && !editableHtml && !templateCode) return null;
  return (
    <div className="inline-flex items-center gap-2">
      {templateCode && (
        <FormTemplateButton
          code={templateCode}
          title={templateTitle || editableTitle || label}
          defaultHtml={templateDefaultHtml}
          size={size}
          variant={variant}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} variant={variant}>
            <Download className="w-4 h-4 mr-2" />
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>เลือกรูปแบบ</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {editableHtml && (
            <>
              <DropdownMenuItem onClick={openEditor}>
                <FileEdit className="w-4 h-4 mr-2" />
                แก้ไขก่อนส่งออก (Word-like)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {actions.map((a) => (
            <DropdownMenuItem key={a.key} onClick={() => a.onClick()}>
              {iconFor(a.icon)}
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {editableHtml && (
        <EditBeforeExportDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          title={editableTitle || label}
          html={editorHtml}
          filename={editableFilename || "document"}
        />
      )}
    </div>
  );
};


