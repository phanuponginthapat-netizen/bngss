export function arAttribute(value: unknown): string {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function arMediaUrl(value: string): string {
  const url = new URL(value, window.location.origin);
  if (!['https:', 'http:', 'blob:'].includes(url.protocol)) throw new Error('ลิงก์สื่อไม่ปลอดภัย');
  if (/[\s;()]/.test(value)) throw new Error('ลิงก์สื่อไม่ถูกต้อง');
  return arAttribute(url.href);
}