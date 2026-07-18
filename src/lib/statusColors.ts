/**
 * Centralized semantic status color tokens.
 * All values map to theme CSS variables (--success, --warning, --danger, --info, --neutral)
 * defined in src/index.css and exposed via tailwind.config.ts.
 *
 * NEVER hardcode color utilities (bg-green-100, bg-[#xxx], etc.) outside theme settings
 * pages and the credit footer.
 */

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

/** Soft (pastel bg + dark fg) — best for badges, table cells, info panels. */
export const tone = {
  success: "bg-success-soft text-success-soft-foreground border-success/20",
  warning: "bg-warning-soft text-warning-soft-foreground border-warning/20",
  danger: "bg-danger-soft text-danger-soft-foreground border-danger/20",
  info: "bg-info-soft text-info-soft-foreground border-info/20",
  neutral: "bg-neutral-soft text-neutral-soft-foreground border-neutral/20",
  primary: "bg-primary/10 text-primary border-primary/20",
} as const satisfies Record<Tone, string>;

/** Solid (filled bg + on-color fg) — best for primary action buttons, status pills. */
export const toneSolid = {
  success: "bg-success text-success-foreground hover:bg-success/90",
  warning: "bg-warning text-warning-foreground hover:bg-warning/90",
  danger: "bg-danger text-danger-foreground hover:bg-danger/90",
  info: "bg-info text-info-foreground hover:bg-info/90",
  neutral: "bg-neutral text-neutral-foreground hover:bg-neutral/90",
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
} as const satisfies Record<Tone, string>;

/** Outline (transparent bg + colored border/text) — for secondary actions. */
export const toneOutline = {
  success: "border border-success/40 text-success hover:bg-success/10",
  warning: "border border-warning/40 text-warning hover:bg-warning/10",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
  info: "border border-info/40 text-info hover:bg-info/10",
  neutral: "border border-neutral/40 text-neutral hover:bg-neutral/10",
  primary: "border border-primary/40 text-primary hover:bg-primary/10",
} as const satisfies Record<Tone, string>;

/* -------------------------------------------------------------------------- */
/* Domain-specific maps                                                       */
/* -------------------------------------------------------------------------- */

/** Student/staff attendance — present | absent | late | leave | other */
export function attendanceStatusBadge(status: string | null | undefined): string {
  switch (status) {
    case "present":
    case "ok":
      return tone.success;
    case "absent":
      return tone.danger;
    case "late":
      return tone.warning;
    case "leave":
    case "sick":
    case "personal":
      return tone.info;
    default:
      return tone.neutral;
  }
}

/** Solid variant of attendance status — for action buttons / scan results */
export function attendanceStatusSolid(status: string | null | undefined): string {
  switch (status) {
    case "present":
    case "ok":
      return toneSolid.success;
    case "absent":
      return toneSolid.danger;
    case "late":
      return toneSolid.warning;
    case "leave":
    case "sick":
    case "personal":
      return toneSolid.info;
    default:
      return toneSolid.neutral;
  }
}

/** E-Form workflow status */
export function eformStatusBadge(status: string | null | undefined): string {
  switch (status) {
    case "draft":
      return tone.neutral;
    case "submitted":
    case "in_review":
    case "pending":
      return tone.info;
    case "awaiting_signature":
    case "waiting":
      return tone.warning;
    case "approved":
    case "signed":
    case "completed":
      return tone.success;
    case "rejected":
    case "cancelled":
      return tone.danger;
    default:
      return tone.neutral;
  }
}

/** Procurement document status (request → approve → po → receive → close) */
export function procurementStatusBadge(status: string | null | undefined): string {
  switch (status) {
    case "draft":
      return tone.neutral;
    case "pending":
    case "submitted":
      return tone.warning;
    case "approved":
      return tone.success;
    case "po_issued":
    case "ordered":
      return tone.info;
    case "received":
    case "delivered":
      return tone.success;
    case "closed":
      return tone.neutral;
    case "rejected":
    case "cancelled":
      return tone.danger;
    default:
      return tone.neutral;
  }
}

/** Asset borrow status */
export function borrowStatusBadge(status: string | null | undefined): string {
  switch (status) {
    case "pending":
      return tone.warning;
    case "approved":
    case "borrowed":
      return tone.success;
    case "returned":
      return tone.info;
    default:
      return tone.neutral;
  }
}

/** Generic project status */
export function projectStatusBadge(status: string | null | undefined): string {
  switch (status) {
    case "planning":
    case "draft":
      return tone.neutral;
    case "in_progress":
    case "active":
      return tone.info;
    case "pending":
    case "review":
      return tone.warning;
    case "completed":
    case "done":
      return tone.success;
    case "cancelled":
    case "rejected":
      return tone.danger;
    default:
      return tone.neutral;
  }
}

/** Priority for inbox / tasks */
export function priorityBadge(priority: string | null | undefined): string {
  switch (priority) {
    case "urgent":
    case "critical":
    case "high":
      return toneSolid.danger;
    case "medium":
      return toneSolid.warning;
    case "low":
      return toneSolid.info;
    default:
      return toneSolid.neutral;
  }
}

/** Face-scan entry/exit brand colors */
export const scanBrand = {
  entry: "bg-brand-entry text-brand-entry-foreground hover:bg-brand-entry/90",
  exit: "bg-brand-exit text-brand-exit-foreground hover:bg-brand-exit/90",
  entrySoft: "bg-brand-entry-soft text-brand-entry border-brand-entry/30",
  exitSoft: "bg-brand-exit-soft text-brand-exit border-brand-exit/30",
} as const;

/** Rate-to-tone: 0-100 percentage → success/warning/danger */
export function rateTone(rate: number): string {
  if (rate >= 80) return tone.success;
  if (rate >= 50) return tone.warning;
  return tone.danger;
}
