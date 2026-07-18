import Swal, { SweetAlertOptions, SweetAlertResult } from "sweetalert2";
import { toThaiErrorDetailed, toThaiErrorDetailedSync } from "./errorMessage";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/**
 * SweetAlert popup helpers — ใช้ font + theme ของระบบ (รองรับ dark mode)
 * เรียกใช้: import { swal } from "@/lib/swal"
 *   swal.success("บันทึกแล้ว")
 *   swal.error("เกิดข้อผิดพลาด", err.message)
 *   await swal.confirm({ title: "ยืนยันการลบ?", confirmText: "ลบ" })
 */

const baseClass = {
  popup: "swal-pop !rounded-2xl !shadow-2xl !font-[inherit] !bg-card !text-foreground border border-border",
  title: "!text-foreground !text-lg !font-bold",
  htmlContainer: "!text-muted-foreground !text-sm",
  confirmButton:
    "!bg-primary !text-primary-foreground hover:!opacity-90 !rounded-lg !px-4 !py-2 !font-semibold !shadow-sm focus:!ring-2 focus:!ring-primary/30 !mx-1",
  cancelButton:
    "!bg-muted !text-foreground hover:!bg-muted/80 !rounded-lg !px-4 !py-2 !font-semibold !mx-1",
  denyButton:
    "!bg-destructive !text-destructive-foreground hover:!opacity-90 !rounded-lg !px-4 !py-2 !font-semibold !mx-1",
  actions: "!gap-2 !mt-2",
  icon: "!my-3",
  timerProgressBar: "!bg-primary",
};

const base = (opts: SweetAlertOptions = {}): SweetAlertOptions => ({
  buttonsStyling: false,
  customClass: baseClass,
  reverseButtons: true,
  heightAuto: false,
  target: "body",
  focusConfirm: true,
  returnFocus: false,
  ...opts,
});

const toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  buttonsStyling: false,
  customClass: { ...baseClass, popup: baseClass.popup + " !p-3" },
});

export const swal = {
  success: (title: string, text?: string) =>
    Swal.fire(base({ icon: "success", title, text, timer: 2500, showConfirmButton: false, timerProgressBar: true })),

  /**
   * แสดง error dialog — รับได้ทั้ง string ธรรมดา หรือ Error/unknown object
   * ถ้าเป็น object จะแปลงเป็นข้อความไทยอัตโนมัติ (รวมถึงดึง body จาก Edge Function response)
   */
  error: async (title: string, textOrError?: string | unknown) => {
    let html: string | undefined;
    if (textOrError != null) {
      const d = typeof textOrError === "string"
        ? toThaiErrorDetailedSync(textOrError)
        : await toThaiErrorDetailed(textOrError);
      html = `
        <div class="text-left space-y-2">
          <div class="text-foreground text-sm"><span class="font-semibold">สาเหตุ:</span> ${escapeHtml(d.reason)}</div>
          <div class="text-muted-foreground text-sm"><span class="font-semibold">คำแนะนำ:</span> ${escapeHtml(d.hint)}</div>
        </div>`;
    }
    return Swal.fire(base({ icon: "error", title, html, confirmButtonText: "ตกลง" }));
  },


  warning: (title: string, text?: string) =>
    Swal.fire(base({ icon: "warning", title, text, confirmButtonText: "ตกลง" })),

  info: (title: string, text?: string) =>
    Swal.fire(base({ icon: "info", title, text, confirmButtonText: "ตกลง" })),

  /**
   * Confirm dialog — return true ถ้าผู้ใช้กด confirm
   * @example const ok = await swal.confirm({ title: "ยืนยันการลบ?", danger: true });
   */
  confirm: async ({
    title,
    text,
    confirmText = "ยืนยัน",
    cancelText = "ยกเลิก",
    danger = false,
    icon = "question",
  }: {
    title: string;
    text?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    icon?: "warning" | "question" | "info";
  }): Promise<boolean> => {
    const res = await Swal.fire(
      base({
        title,
        text,
        icon,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        customClass: {
          ...baseClass,
          confirmButton: danger ? baseClass.denyButton : baseClass.confirmButton,
        },
      }),
    );
    return !!res.isConfirmed;
  },

  /** Toast แบบมุมขวาบน (สำหรับ notice สั้นๆ ไม่บล็อก UI) */
  toast: {
    success: (title: string) => toast.fire({ icon: "success", title }),
    error: (title: string) => toast.fire({ icon: "error", title }),
    info: (title: string) => toast.fire({ icon: "info", title }),
    warning: (title: string) => toast.fire({ icon: "warning", title }),
  },

  /** ช่อง input prompt — return ค่าที่กรอก หรือ null ถ้ายกเลิก */
  prompt: async (title: string, opts: {
    placeholder?: string;
    defaultValue?: string;
    inputType?: "text" | "email" | "password" | "number" | "textarea";
  } = {}): Promise<string | null> => {
    const res: SweetAlertResult = await Swal.fire(
      base({
        title,
        input: opts.inputType || "text",
        inputPlaceholder: opts.placeholder,
        inputValue: opts.defaultValue || "",
        showCancelButton: true,
        confirmButtonText: "ตกลง",
        cancelButtonText: "ยกเลิก",
      }),
    );
    return res.isConfirmed ? (res.value ?? "") : null;
  },

  /** loading dialog — เรียก swal.close() เมื่อเสร็จ */
  loading: (title = "กำลังประมวลผล...") => {
    Swal.fire(
      base({
        title,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      }),
    );
  },

  close: () => Swal.close(),
  fire: (opts: SweetAlertOptions) => Swal.fire(base(opts)),
};

export default swal;
