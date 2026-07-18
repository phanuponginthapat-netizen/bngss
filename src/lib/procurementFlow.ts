// EGP procurement workflow helpers — matches the 4-step flowchart

export type ProcurementStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "purchasing"
  | "received"
  | "clearing"
  | "closed"
  | "cancelled";

export type CaseType = "case1_direct" | "case2_advance";
export type RequestType = "purchase" | "activity";

export const STATUS_META: Record<ProcurementStatus, { label: string; color: string; step: number }> = {
  draft:            { label: "ร่าง",            color: "bg-neutral-soft text-neutral-soft-foreground", step: 1 },
  pending_approval: { label: "รออนุมัติ",       color: "bg-warning-soft text-warning-soft-foreground", step: 2 },
  approved:         { label: "อนุมัติแล้ว",     color: "bg-success-soft text-success-soft-foreground", step: 2 },
  purchasing:       { label: "กำลังจัดซื้อ",     color: "bg-info-soft text-info-soft-foreground",       step: 3 },
  received:         { label: "รับของแล้ว",       color: "bg-info-soft text-info-soft-foreground",       step: 3 },
  clearing:         { label: "กำลังล้างหนี้",    color: "bg-primary/10 text-primary",                   step: 4 },
  closed:           { label: "ปิดงาน",          color: "bg-neutral-soft text-neutral-soft-foreground", step: 4 },
  cancelled:        { label: "ยกเลิก",          color: "bg-danger-soft text-danger-soft-foreground",   step: 0 },
};

export const CASE_LABEL: Record<CaseType, string> = {
  case1_direct: "กรณี 1: มีงบจัดซื้อโดยตรง",
  case2_advance: "กรณี 2: ใช้เงินยืมรองราชการ",
};

export const REQUEST_LABEL: Record<RequestType, string> = {
  purchase: "ซื้อพัสดุ/จ้าง",
  activity: "จัดกิจกรรม",
};

export const STEPS = [
  { id: 1, label: "ขอซื้อ/จ้าง", desc: "สร้างคำขอ + TOR" },
  { id: 2, label: "อนุมัติ",     desc: "ผู้บริหาร/หัวหน้าพัสดุ" },
  { id: 3, label: "จัดซื้อ/รับของ", desc: "ดำเนินตามระเบียบพัสดุ" },
  { id: 4, label: "ล้างหนี้ EGP", desc: "บันทึก EGPEASY/e-GP" },
] as const;

export const ADVANCE_STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: "ขอยืม",      color: "bg-warning-soft text-warning-soft-foreground" },
  approved:  { label: "อนุมัติ",    color: "bg-success-soft text-success-soft-foreground" },
  disbursed: { label: "จ่ายแล้ว",   color: "bg-info-soft text-info-soft-foreground" },
  cleared:   { label: "ส่งใช้แล้ว", color: "bg-neutral-soft text-neutral-soft-foreground" },
};

/** Allowed next statuses from current — used to decide which action buttons to show */
export function nextStatuses(current: ProcurementStatus): ProcurementStatus[] {
  switch (current) {
    case "draft":            return ["pending_approval", "cancelled"];
    case "pending_approval": return ["approved", "cancelled"];
    case "approved":         return ["purchasing", "cancelled"];
    case "purchasing":       return ["received", "cancelled"];
    case "received":         return ["clearing"];
    case "clearing":         return ["closed"];
    default:                 return [];
  }
}

export function statusTimestampField(s: ProcurementStatus): string | null {
  switch (s) {
    case "approved":   return "approved_at";
    case "purchasing": return "purchased_at";
    case "received":   return "received_at";
    case "closed":     return "cleared_at";
    default: return null;
  }
}

export const fmtMoney = (n: number) =>
  Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
