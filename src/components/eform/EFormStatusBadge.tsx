import { Badge } from "@/components/ui/badge";
import { tone } from "@/lib/statusColors";

export type EFormStatus = "draft" | "sent" | "pending_signature" | "completed" | "rejected";

export const EFORM_STATUS_MAP: Record<EFormStatus, { label: string; cls: string; icon?: string }> = {
  draft: { label: "ร่าง", cls: tone.neutral },
  sent: { label: "ส่งแล้ว", cls: tone.info },
  pending_signature: { label: "รอผู้ลงนาม", cls: tone.warning },
  completed: { label: "เสร็จสมบูรณ์", cls: tone.success },
  rejected: { label: "ถูกปฏิเสธ", cls: tone.danger },
};

export const EFormStatusBadge = ({ status }: { status: string }) => {
  const m = EFORM_STATUS_MAP[(status as EFormStatus)] || EFORM_STATUS_MAP.sent;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
};
