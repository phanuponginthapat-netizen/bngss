import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  evaluatorName: string;
  evaluatorComments: string;
  onNameChange: (v: string) => void;
  onCommentsChange: (v: string) => void;
}

export default function PAEvaluatorSection({ evaluatorName, evaluatorComments, onNameChange, onCommentsChange }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">ข้อมูลผู้ประเมิน</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">ชื่อผู้ประเมิน</Label><Input value={evaluatorName} onChange={e => onNameChange(e.target.value)} /></div>
        </div>
        <div><Label className="text-xs">ความเห็นรวม</Label><Textarea value={evaluatorComments} onChange={e => onCommentsChange(e.target.value)} rows={3} /></div>
      </CardContent>
    </Card>
  );
}
