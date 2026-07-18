import { STEPS, STATUS_META, nextStatuses, statusTimestampField, type ProcurementStatus } from "@/lib/procurementFlow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ArrowRight, X } from "lucide-react";

interface Props {
  status: ProcurementStatus;
  canManage: boolean;
  onMove: (next: ProcurementStatus, tsField: string | null) => void;
}

export default function ProcurementStepper({ status, canManage, onMove }: Props) {
  const currentStep = STATUS_META[status]?.step ?? 0;
  const nexts = nextStatuses(status);
  const cancelled = status === "cancelled";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const done = currentStep > s.id;
          const active = currentStep === s.id;
          return (
            <div key={s.id} className="flex items-center gap-1 flex-1">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs flex-1 ${
                done ? "bg-success-soft text-success" :
                active ? "bg-primary/10 text-primary font-medium" :
                "bg-muted text-muted-foreground"
              }`}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                <span>{s.id}. {s.label}</span>
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {canManage && !cancelled && nexts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {nexts.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={n === "cancelled" ? "outline" : "default"}
              className="h-7 text-xs"
              onClick={() => onMove(n, statusTimestampField(n))}
            >
              {n === "cancelled" ? <X className="w-3 h-3 mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              เปลี่ยนเป็น: {STATUS_META[n].label}
            </Button>
          ))}
        </div>
      )}
      {cancelled && <Badge className="bg-danger-soft text-danger">รายการนี้ถูกยกเลิก</Badge>}
    </div>
  );
}
