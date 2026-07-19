import { ZodSchema } from "zod";
import { swal } from "./swal";

/**
 * Validate กับ zod schema → ถ้า fail แสดง SweetAlert error พร้อม bullet list
 * ถ้าผ่าน → ถาม confirm (เว้นแต่ skipConfirm)
 *
 * @example
 *   const schema = z.object({ email: z.string().email(), name: z.string().min(1).max(80) });
 *   const { ok, data } = await validateAndConfirm(schema, form, { confirmTitle: "บันทึกผู้ใช้?" });
 *   if (!ok) return;
 *   await saveToApi(data);
 */
export async function validateAndConfirm<T>(
  schema: ZodSchema<T>,
  raw: unknown,
  opts: {
    confirmTitle?: string;
    confirmText?: string;
    confirmButtonText?: string;
    skipConfirm?: boolean;
    danger?: boolean;
    /** label map: { email: "อีเมล", first_name: "ชื่อ" } */
    labels?: Record<string, string>;
  } = {},
): Promise<{ ok: boolean; data?: T }> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => {
        const key = i.path.join(".") || "field";
        const label = opts.labels?.[key] || key;
        return `<li><b>${label}</b>: ${i.message}</li>`;
      })
      .join("");
    await swal.fire({
      icon: "error",
      title: "ข้อมูลไม่ถูกต้อง",
      html: `<ul style="text-align:left;padding-left:1.2rem;margin:0">${issues}</ul>`,
      confirmButtonText: "ตกลง",
    });
    return { ok: false };
  }
  if (opts.skipConfirm) return { ok: true, data: parsed.data };
  const ok = await swal.confirm({
    title: opts.confirmTitle || "ยืนยันการบันทึก?",
    text: opts.confirmText,
    confirmText: opts.confirmButtonText || "ยืนยัน",
    danger: opts.danger,
    icon: "question",
  });
  return { ok, data: ok ? parsed.data : undefined };
}

/** เตือนทันทีตอน user พิมพ์เกิน max (เรียกใน onChange/onBlur) */
let lastWarn = 0;
export function warnIfTooLong(label: string, value: string, max: number) {
  if (!value || value.length <= max) return;
  const now = Date.now();
  if (now - lastWarn < 1500) return; // throttle เพื่อไม่ให้ toast ซ้อน
  lastWarn = now;
  swal.toast.warning(`${label} ยาวเกิน ${max} ตัวอักษร`);
}

/** เตือนถ้า format ไม่ตรง (เช่น email, เบอร์โทร) */
export function warnIfInvalidFormat(label: string, value: string, regex: RegExp) {
  if (!value) return;
  if (regex.test(value)) return;
  const now = Date.now();
  if (now - lastWarn < 1500) return;
  lastWarn = now;
  swal.toast.warning(`${label} รูปแบบไม่ถูกต้อง`);
}

export const commonRegex = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // อนุญาตเว้นวรรค/ขีดในเบอร์ — ตรวจเฉพาะตัวเลขจริง 9–10 หลักขึ้นต้นด้วย 0 หรือ +66
  phoneTH: /^(\+?66|0)[\s\-\d]{8,15}$/,
  nationalIdTH: /^\d{13}$/,
};

/**
 * ตรวจ checksum เลขบัตรประชาชนไทย 13 หลัก
 * สูตร: sum(d[i] * (13-i)) for i=0..11, then checkDigit = (11 - sum % 11) % 10 === d[12]
 * ใช้เพื่อกันการพิมพ์เลขบัตรผิด (ไม่ใช่แค่จำนวนหลัก)
 */
export function isValidThaiNationalId(id: string): boolean {
  const s = (id || "").replace(/\D/g, "");
  if (s.length !== 13) return false;
  if (/^(\d)\1{12}$/.test(s)) return false; // 0000000000000 ฯลฯ
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(s[i], 10) * (13 - i);
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(s[12], 10);
}

