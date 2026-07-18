import { Badge } from "@/components/ui/badge";

export type EFormStatus = "draft" | "sent" | "pending_signature" | "completed" | "rejected";

export const EFORM_STATUS_MAP: Record<EFormStatus, { label: string; cls: string; icon?: string }> = {
  draft: { label: "ร่าง", cls: "bg-gray-100 text-gray-700 border-gray-300" },
  sent: { label: "ส่งแล้ว", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  pending_signature: { label: "รอผู้ลงนาม", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  completed: { label: "เสร็จสมบูรณ์", cls: "bg-green-100 text-green-800 border-green-300" },
  rejected: { label: "ถูกปฏิเสธ", cls: "bg-red-100 text-red-800 border-red-300" },
};

export const EFormStatusBadge = ({ status }: { status: string }) => {
  const m = EFORM_STATUS_MAP[(status as EFormStatus)] || EFORM_STATUS_MAP.sent;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
};
