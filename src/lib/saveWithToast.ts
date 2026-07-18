import { toast } from "sonner";

/**
 * Wrap any async save operation with an immediate "กำลังบันทึก..." toast
 * that transitions to success/error when it settles.
 *
 * Usage:
 *   await saveWithToast(async () => {
 *     await supabase.from("...").upsert(...);
 *   });
 *
 *   // or with custom labels
 *   await saveWithToast(doSave, { loading: "กำลังอัปโหลด...", success: "อัปโหลดสำเร็จ" });
 */
export type SaveToastLabels = {
  loading?: string;
  success?: string;
  error?: string;
};

export function saveWithToast<T>(
  fn: () => Promise<T>,
  labels: SaveToastLabels = {}
): Promise<T> {
  const promise = fn();
  toast.promise(promise, {
    loading: labels.loading ?? "กำลังบันทึก...",
    success: labels.success ?? "บันทึกสำเร็จ",
    error: (e: any) =>
      (labels.error ?? "บันทึกไม่สำเร็จ") +
      (e?.message ? `: ${e.message}` : ""),
  });
  return promise;
}
