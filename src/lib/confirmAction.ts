import { swal } from "@/lib/swal";

/**
 * Confirm Action Module — ใช้ยืนยันก่อนกระทำสำคัญ
 * ครอบ swal.confirm พร้อม preset มาตรฐาน
 *
 * @example
 *   if (!(await confirmDelete("ลบนักเรียน?", "ข้อมูลทั้งหมดจะถูกลบถาวร"))) return;
 *   if (!(await confirmSave("บันทึกการเปลี่ยนแปลง?"))) return;
 *   if (!(await confirmCreate("เพิ่มรายการใหม่?"))) return;
 */

export type ConfirmOptions = {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
};

/** ยืนยันการลบ — สีแดง (danger) */
export const confirmDelete = (title: string, text?: string) =>
  swal.confirm({
    title,
    text,
    icon: "warning",
    confirmText: "ลบ",
    cancelText: "ยกเลิก",
    danger: true,
  });

/** ยืนยันการบันทึก */
export const confirmSave = (title = "ยืนยันการบันทึก?", text?: string) =>
  swal.confirm({
    title,
    text,
    icon: "question",
    confirmText: "บันทึก",
    cancelText: "ยกเลิก",
  });

/** ยืนยันการเพิ่ม */
export const confirmCreate = (title = "ยืนยันการเพิ่มข้อมูล?", text?: string) =>
  swal.confirm({
    title,
    text,
    icon: "question",
    confirmText: "เพิ่ม",
    cancelText: "ยกเลิก",
  });

/** ยืนยันการแก้ไข */
export const confirmUpdate = (title = "ยืนยันการแก้ไข?", text?: string) =>
  swal.confirm({
    title,
    text,
    icon: "question",
    confirmText: "แก้ไข",
    cancelText: "ยกเลิก",
  });

/** ยืนยันการส่ง (submit/approve) */
export const confirmSubmit = (title = "ยืนยันการส่ง?", text?: string) =>
  swal.confirm({
    title,
    text,
    icon: "question",
    confirmText: "ส่ง",
    cancelText: "ยกเลิก",
  });

/** ยืนยันแบบ critical — ต้องพิมพ์ข้อความเพื่อยืนยัน */
export async function confirmCritical({
  title,
  text,
  matchText,
}: {
  title: string;
  text?: string;
  matchText: string;
}): Promise<boolean> {
  const v = await swal.prompt(title, {
    placeholder: `พิมพ์ "${matchText}" เพื่อยืนยัน`,
    inputType: "text",
  });
  if (v === null) return false;
  if (v.trim() !== matchText) {
    await swal.error("ข้อความไม่ตรงกัน", "ยกเลิกการดำเนินการ");
    return false;
  }
  return true;
}

/** ทั่วไป — pass-through */
export const confirmAction = (opts: ConfirmOptions & { danger?: boolean }) =>
  swal.confirm({
    title: opts.title,
    text: opts.text,
    confirmText: opts.confirmText ?? "ยืนยัน",
    cancelText: opts.cancelText ?? "ยกเลิก",
    danger: opts.danger,
  });

export default {
  delete: confirmDelete,
  save: confirmSave,
  create: confirmCreate,
  update: confirmUpdate,
  submit: confirmSubmit,
  critical: confirmCritical,
  action: confirmAction,
};
