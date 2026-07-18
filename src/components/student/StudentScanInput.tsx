import { useState, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { supabase } from "@/integrations/supabase/client";
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
    const code = (raw || "").trim();
    if (!code) return;

    // Always reflect into the search box if present
    onChange?.(code);

    // Lookup if caller wants the full student record
    if (onStudentFound) {
      try {
        let q = supabase
          .from("students")
          .select("id, student_code, prefix, first_name, last_name, classroom_id")
          .eq("student_code", code)
          .limit(1);
        if (classroomId) q = q.eq("classroom_id", classroomId);
        const { data, error } = await q.maybeSingle();
        if (error) throw error;
        if (!data) {
          toast.error(`ไม่พบนักเรียนรหัส ${code}${classroomId ? " ในห้องนี้" : ""}`);
          return;
        }
        onStudentFound(data as Student);
        toast.success(`พบ: ${data.first_name ?? ""} ${data.last_name ?? ""}`.trim());
      } catch (e: any) {
        toast.error(e.message || "ค้นหาไม่สำเร็จ");
      }
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
