import { Button } from "@/components/ui/button";
import { FileEdit, FilePenLine } from "lucide-react";

interface Props {
  /** unique template code, e.g. "pp3", "pp5", "eform", "saraban" */
  code: string;
  /** human-readable title shown in editor */
  title: string;
  /** fallback content if no template saved yet */
  defaultHtml?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
  /** button label override (default: "ดูตัวอย่างฟอร์ม") */
  label?: string;
  /** extra className on trigger button */
  className?: string;
  /** ซ่อนปุ่ม "กรอกแบบฟอร์ม" (ถ้าฟอร์มนั้นไม่มี field) */
  hideFill?: boolean;
}

/**
 * ปุ่มเปิด Form Template:
 *  1) "แก้ไขฟอร์ม" → /form-template/:code         (Word editor เต็มจอ)
 *  2) "กรอกแบบฟอร์ม" → /form-template/:code/fill  (ฟอร์มกรอกข้อมูล + preview)
 */
export default function FormTemplateButton({
  code, title, defaultHtml = "", size = "sm", variant = "outline", label, className, hideFill,
}: Props) {
  const openEditor = () => {
    const params = new URLSearchParams({ title });
    if (defaultHtml) {
      try { params.set("default", btoa(unescape(encodeURIComponent(defaultHtml)))); } catch {}
    }
    window.open(`/form-template/${encodeURIComponent(code)}?${params.toString()}`, "_blank", "noopener");
  };
  const openFill = () => {
    const params = new URLSearchParams({ title });
    window.open(`/form-template/${encodeURIComponent(code)}/fill?${params.toString()}`, "_blank", "noopener");
  };

  return (
    <div className="inline-flex gap-2">
      <Button size={size} variant={variant} onClick={openEditor} className={className}>
        <FileEdit className="w-4 h-4 mr-2" />
        {label || "แก้ไขฟอร์ม"}
      </Button>
      {!hideFill && (
        <Button size={size} variant="default" onClick={openFill} className={className}>
          <FilePenLine className="w-4 h-4 mr-2" />
          กรอกแบบฟอร์ม
        </Button>
      )}
    </div>
  );
}
