import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { extractScannedCode, resolveScannedStudent } from "@/lib/resolveScannedStudent";
import { toast } from "sonner";

interface Props {
  onScan: (code: string) => void;
  title?: string;
  className?: string;
  /**
   * ถ้าเปิด (default) จะ resolve QR/URL ของบัตรนักเรียนแล้วส่งคืน `student_code`
   * แทนที่จะส่ง URL ดิบ ๆ เข้าไปที่ช่องค้นหา — ทำให้บัตรที่พิมพ์เป็น URL
   * (`/p/<auth_user_id>`, `/sdq-assess/<student.id>`) ใช้สแกนหานักเรียนได้จริง
   */
  resolveStudent?: boolean;
}

/** Compact scan button to place next to a student search input. */
export const ScanSearchButton = ({ onScan, title = "สแกนบัตรนักเรียน", className, resolveStudent = true }: Props) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleScan = async (raw: string) => {
    const c = (raw || "").trim();
    if (!c) return;
    if (!resolveStudent) {
      onScan(c);
      return;
    }
    // ลอง resolve เป็นนักเรียนก่อน — ถ้าเจอ ส่ง student_code เข้าไป
    setBusy(true);
    try {
      const s = await resolveScannedStudent(c);
      if (s?.student_code) {
        onScan(s.student_code);
      } else {
        // ไม่พบ → ส่งค่าที่ extract ได้ (อย่างน้อยไม่ใช่ URL เต็ม) ให้ไปเสิร์ชต่อ
        const code = extractScannedCode(c);
        onScan(code || c);
        toast.info(`ไม่พบนักเรียนจาก QR — ค้นหาด้วย "${code || c}"`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        title={title}
        disabled={busy}
        className={`shrink-0 ${className ?? ""}`}
      >
        <ScanLine className="h-4 w-4" />
      </Button>
      <BarcodeScanner
        open={open}
        onClose={() => setOpen(false)}
        onScan={handleScan}
        title={title}
      />
    </>
  );
};

export default ScanSearchButton;

