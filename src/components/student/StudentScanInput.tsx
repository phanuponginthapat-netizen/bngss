import { useState, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { resolveScannedStudent, extractScannedCode } from "@/lib/resolveScannedStudent";
import { toast } from "sonner";

interface Student {
  id: string;
  student_code: string | null;
  prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  classroom_id?: string | null;
}

interface Props {
  /** Current input value (รหัส/ชื่อ) */
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  /** When provided, scanner looks up the student in DB and returns the row */
  onStudentFound?: (student: Student) => void;
  /** Restrict lookup to a classroom */
  classroomId?: string | null;
  /** Hide the text input — show only the scan button */
  buttonOnly?: boolean;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  scanTitle?: string;
}

export const StudentScanInput = forwardRef<HTMLInputElement, Props>(({
  value, onChange, placeholder = "ค้นหา รหัส / ชื่อ นักเรียน",
  onStudentFound, classroomId, buttonOnly, className, inputClassName, disabled, scanTitle,
}, ref) => {
  const [scanOpen, setScanOpen] = useState(false);

  const handleScan = async (raw: string) => {
    const trimmed = (raw || "").trim();
    if (!trimmed) return;

    try {
      const student = await resolveScannedStudent(trimmed, { classroomId });

      if (student) {
        // สะท้อนรหัสจริงลงช่องค้นหา (ไม่ใช่ URL ของ QR)
        onChange?.(student.student_code || extractScannedCode(trimmed));
        if (onStudentFound) {
          onStudentFound(student as Student);
          toast.success(`พบ: ${student.first_name ?? ""} ${student.last_name ?? ""}`.trim());
        }
        return;
      }

      // ไม่พบ — สะท้อนสิ่งที่ extract ได้ลงช่องค้นหา
      const code = extractScannedCode(trimmed);
      onChange?.(code || trimmed);
      if (onStudentFound) {
        toast.error(`ไม่พบนักเรียนจาก QR${classroomId ? " ในห้องนี้" : ""} (${code || trimmed})`);
      }
    } catch (e: any) {
      toast.error(e?.message || "ค้นหาไม่สำเร็จ");
    }
  };


  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {!buttonOnly && (
        <Input
          ref={ref}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClassName}
        />
      )}
      <Button
        type="button"
        variant="outline"
        size={buttonOnly ? "default" : "icon"}
        onClick={() => setScanOpen(true)}
        disabled={disabled}
        title="สแกนบัตรนักเรียน / QR / Barcode"
        className="shrink-0"
      >
        <ScanLine className="h-4 w-4" />
        {buttonOnly && <span className="ml-2">สแกนบัตร</span>}
      </Button>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
        title={scanTitle ?? "สแกนบัตรนักเรียน"}
      />
    </div>
  );
});

StudentScanInput.displayName = "StudentScanInput";
