import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Printer } from "lucide-react";
import { OfficialDocument, OfficialDocSpec, DOC_KIND_LABELS } from "@/lib/print-engine";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SAMPLE: OfficialDocSpec = {
  kind: "external",
  school: {
    name: "โรงเรียนบ้านตัวอย่าง",
    address: "๑๒๓ หมู่ ๔ ตำบลตัวอย่าง\nอำเภอตัวอย่าง จังหวัดตัวอย่าง ๑๒๓๔๕",
    phone: "๐ ๒๑๒๓ ๔๕๖๗",
    email: "school@example.ac.th",
  },
  refNo: "ศธ ๐๔๑๒๓/๒๕๖๗",
  date: "๒๓ มิถุนายน ๒๕๖๙",
  subject: "ขอเชิญเข้าร่วมการประชุมผู้ปกครองนักเรียน",
  to: "ผู้ปกครองนักเรียน",
  refs: ["หนังสือสำนักงานเขตพื้นที่การศึกษา ที่ ศธ ๐๔๐๐๑/๔๕๖ ลงวันที่ ๑ มิถุนายน ๒๕๖๙"],
  attachments: ["กำหนดการประชุม จำนวน ๑ ฉบับ"],
  body:
    "ด้วยโรงเรียนบ้านตัวอย่าง จะจัดประชุมผู้ปกครองนักเรียน ประจำภาคเรียนที่ ๑ ปีการศึกษา ๒๕๖๙ เพื่อชี้แจงนโยบายและแนวทางการจัดการเรียนการสอน ตลอดจนรายงานผลการดำเนินงานของโรงเรียนในรอบที่ผ่านมา\n\nในการนี้ จึงขอเชิญท่านเข้าร่วมประชุมในวันเสาร์ที่ ๓๐ มิถุนายน ๒๕๖๙ เวลา ๐๙.๐๐ น. ณ หอประชุมโรงเรียนบ้านตัวอย่าง ตามกำหนดการที่แนบมาพร้อมนี้",
  closing: "จึงเรียนมาเพื่อโปรดทราบและเข้าร่วมประชุมตามวัน เวลา และสถานที่ดังกล่าว",
  salutation: "ขอแสดงความนับถือ",
  signer: {
    name: "นายสมชาย ใจดี",
    position: "ผู้อำนวยการโรงเรียนบ้านตัวอย่าง",
  },
};

export default function PrintPreviewPage() {
  const [spec, setSpec] = useState<OfficialDocSpec>(SAMPLE);

  const update = (patch: Partial<OfficialDocSpec>) =>
    setSpec((s) => ({ ...s, ...patch }));

  return (
    <div className="min-h-screen bg-muted/30 p-4 print:p-0 print:bg-white">
      <div className="mx-auto max-w-[1400px] grid lg:grid-cols-[360px_1fr] gap-4 print:block">
        {/* Form panel */}
        <Card className="p-4 space-y-3 print:hidden h-fit sticky top-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Print Engine — ทดสอบ</h2>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" /> พิมพ์
            </Button>
          </div>

          <div>
            <Label>ชนิดเอกสาร</Label>
            <Select value={spec.kind} onValueChange={(v) => update({ kind: v as OfficialDocSpec["kind"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DOC_KIND_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>เลขที่หนังสือ</Label>
            <Input
              value={spec.refNo}
              onChange={(e) => update({ refNo: e.target.value })}
            />
          </div>
          <div>
            <Label>วันที่</Label>
            <Input
              value={spec.date}
              onChange={(e) => update({ date: e.target.value })}
            />
          </div>
          <div>
            <Label>ชื่อโรงเรียน</Label>
            <Input
              value={spec.school.name}
              onChange={(e) =>
                update({ school: { ...spec.school, name: e.target.value } })
              }
            />
          </div>
          <div>
            <Label>ที่อยู่ (ขึ้นบรรทัดใหม่ด้วย Enter)</Label>
            <Textarea
              rows={3}
              value={spec.school.address}
              onChange={(e) =>
                update({ school: { ...spec.school, address: e.target.value } })
              }
            />
          </div>
          <div>
            <Label>เรื่อง</Label>
            <Input
              value={spec.subject}
              onChange={(e) => update({ subject: e.target.value })}
            />
          </div>
          <div>
            <Label>เรียน</Label>
            <Input
              value={spec.to ?? ""}
              onChange={(e) => update({ to: e.target.value })}
            />
          </div>
          <div>
            <Label>เนื้อความ</Label>
            <Textarea
              rows={6}
              value={spec.body}
              onChange={(e) => update({ body: e.target.value })}
            />
          </div>
          <div>
            <Label>คำลงท้าย</Label>
            <Input
              value={spec.closing ?? ""}
              onChange={(e) => update({ closing: e.target.value })}
            />
          </div>
          <div>
            <Label>ผู้ลงนาม</Label>
            <Input
              value={spec.signer.name}
              onChange={(e) =>
                update({ signer: { ...spec.signer, name: e.target.value } })
              }
            />
            <Input
              className="mt-2"
              value={spec.signer.position}
              onChange={(e) =>
                update({ signer: { ...spec.signer, position: e.target.value } })
              }
            />
          </div>
        </Card>

        {/* Preview */}
        <div className="flex justify-center print:block">
          <OfficialDocument spec={spec} />
        </div>
      </div>
    </div>
  );
}
