import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, Loader2, AlertCircle } from "lucide-react";

interface ScoreCellProps {
  initialValue: number | string | null | undefined;
  max: number;
  disabled?: boolean;
  onCommit: (score: number) => void | Promise<void>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Score input ที่:
 * - เก็บค่าใน local state → พิมพ์ลื่น ไม่กระตุก (ไม่ผูกกับ react-query)
 * - Auto-save: ส่งค่าหลังหยุดพิมพ์ 600ms หรือเมื่อ blur (ครูสะสมคะแนนทีละช่องได้)
 * - แสดง indicator: หมุน = กำลังบันทึก, ติ๊กเขียว = บันทึกแล้ว, แดง = error
 * - ขอบแดงเตือนเมื่อกรอกเกิน max
 */
export const ScoreCell = ({ initialValue, max, disabled, onCommit }: ScoreCellProps) => {
  const [value, setValue] = useState<string>(
    initialValue === null || initialValue === undefined || initialValue === "" ? "" : String(initialValue)
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const focusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef<string>(String(initialValue ?? ""));

  useEffect(() => {
    if (focusedRef.current) return;
    const next = initialValue === null || initialValue === undefined || initialValue === "" ? "" : String(initialValue);
    setValue(next);
    lastCommittedRef.current = next;
  }, [initialValue]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const numeric = value === "" ? NaN : parseFloat(value);
  const overMax = !isNaN(numeric) && numeric > max;
  const negative = !isNaN(numeric) && numeric < 0;

  const commit = async (raw: string) => {
    if (raw === lastCommittedRef.current) return;
    let n = parseFloat(raw);
    if (isNaN(n)) n = 0;
    if (n < 0) n = 0;
    if (n > max) n = max;
    lastCommittedRef.current = String(n);
    if (String(n) !== raw) setValue(String(n));
    setSaveState("saving");
    try {
      await onCommit(n);
      setSaveState("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("error");
    }
  };

  return (
    <div className="relative inline-block">
      <Input
        type="number"
        inputMode="decimal"
        step="any"
        min={0}
        max={max}
        disabled={disabled}
        value={value}
        title={overMax ? `เกินคะแนนสูงสุด (${max})` : negative ? "ห้ามติดลบ" : undefined}
        className={cn(
          "h-8 text-center text-sm w-16 mx-auto pr-5",
          disabled && "opacity-40",
          (overMax || negative) && "border-destructive text-destructive focus-visible:ring-destructive"
        )}
        onFocus={() => { focusedRef.current = true; }}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => commit(v), 600);
        }}
        onBlur={(e) => {
          focusedRef.current = false;
          if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {saveState !== "idle" && (
        <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2">
          {saveState === "saving" && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          {saveState === "saved" && <Check className="w-3 h-3 text-success" />}
          {saveState === "error" && <AlertCircle className="w-3 h-3 text-destructive" />}
        </span>
      )}
    </div>
  );
};
