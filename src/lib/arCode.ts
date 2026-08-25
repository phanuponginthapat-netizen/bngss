/** ดึงรหัสจากข้อความ QR ของระบบ AR (รองรับทั้ง URL เต็มและรหัสล้วน) */
export const extractArCode = (raw: string): { type: "item" | "project"; code: string } => {
  const s = (raw || "").trim();
  if (!s) return { type: "item", code: "" };
  const p = s.match(/\/ar\/p\/([A-Za-z0-9_-]+)/);
  if (p?.[1]) return { type: "project", code: p[1] };
  const m = s.match(/\/ar\/([A-Za-z0-9_-]+)/);
  if (m?.[1]) return { type: "item", code: m[1] };
  return { type: "item", code: s.replace(/^.*\//, "") };
};
