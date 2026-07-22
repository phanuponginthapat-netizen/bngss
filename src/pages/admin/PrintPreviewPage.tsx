import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Printer } from "lucide-react";
import { OfficialDocument, OfficialDocSpec, DOC_KIND_LABELS } from "@/lib/print-engine";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCmsSettings } from "@/hooks/useCmsSettings";

export default function PrintPreviewPage() {
  const cms = useCmsSettings();
  const g = (k: string, d = "") => (cms.get?.(k) ?? (cms as any)[k] ?? d) || d;

  // ตัวอย่างเอกสารดึงจาก CMS ทั้งหมด (ห้าม hardcode ชื่อ/ที่อยู่/ผอ.)
  const SAMPLE: OfficialDocSpec = useMemo(() => ({
    kind: "external",
    school: {
      name: g("school_name", "—"),
      address: g("school_address", "—"),
      phone: g("school_phone", ""),
      email: g("admin_email", ""),
    },
    refNo: "ศธ ๐๐๐๐/…",
    date: new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }),
    subject: "หัวเรื่อง (แก้ไขได้)",
    to: "ผู้ปกครองนักเรียน",
    refs: [],
    attachments: [],
    body: `ตัวอย่างเนื้อความ ระบบจะดึงชื่อ ${g("school_name", "โรงเรียน")} จาก CMS โดยอัตโนมัติ`,
    closing: "จึงเรียนมาเพื่อโปรดทราบ",
    salutation: "ขอแสดงความนับถือ",
    signer: {
      name: g("director_name", "—"),
      position: g("director_title", "ผู้อำนวยการโรงเรียน"),
    },
  }), [cms]);

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
