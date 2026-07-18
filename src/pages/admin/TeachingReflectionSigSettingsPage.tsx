import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, FileSignature } from "lucide-react";
import { useAllSignatures } from "@/hooks/useSignatures";
import {
  useReflectionSigSettings, useUpdateReflectionSigSetting,
  type ReflectionSigSetting, type RenderMode, type AlignMode, type SizePreset,
  resolveSizePx,
} from "@/hooks/useReflectionSigSettings";
import type { SignerRole } from "@/hooks/useTeachingReflections";

const SLOTS: { role: SignerRole; label: string; defaultPosition: string }[] = [
  { role: "teacher", label: "ผู้บันทึก (ครูผู้สอน)", defaultPosition: "ครูผู้สอน" },
  { role: "head_subject", label: "หัวหน้ากลุ่มสาระ", defaultPosition: "หัวหน้ากลุ่มสาระ" },
  { role: "academic_head", label: "หัวหน้าฝ่ายวิชาการ", defaultPosition: "หัวหน้าฝ่ายวิชาการ" },
  { role: "deputy", label: "รองผู้อำนวยการ", defaultPosition: "รองผู้อำนวยการ" },
  { role: "director", label: "ผู้อำนวยการ", defaultPosition: "ผู้อำนวยการ" },
];

const RENDER_LABEL: Record<RenderMode, string> = {
  image: "แสดงภาพลายเซ็น",
  blank: "แสดงเฉพาะเส้นว่าง",
  name_only: "แสดงเฉพาะชื่อพิมพ์",
};

function SlotRow({
  slot,
  value,
  onSave,
  signatureOptions,
}: {
  slot: (typeof SLOTS)[number];
  value?: ReflectionSigSetting;
  onSave: (v: Partial<ReflectionSigSetting> & { role: SignerRole }) => void;
  signatureOptions: { id: string; name: string; position: string; url: string }[];
}) {
  const [draft, setDraft] = useState<Partial<ReflectionSigSetting>>({
    render_mode: "image",
    align: "center",
    offset_x_mm: 0,
    offset_y_mm: 0,
    size_preset: "md",
    size_px: 40,
    show_comment_line: slot.role !== "teacher",
    signature_id: null,
    override_name: "",
    override_position: "",
  });
  useEffect(() => {
    if (value) setDraft({
      render_mode: value.render_mode,
      align: value.align,
      offset_x_mm: Number(value.offset_x_mm),
      offset_y_mm: Number(value.offset_y_mm),
      size_preset: value.size_preset,
      size_px: value.size_px,
      show_comment_line: value.show_comment_line,
      signature_id: value.signature_id,
      override_name: value.override_name || "",
      override_position: value.override_position || "",
    });
  }, [value?.id]);

  const selected = signatureOptions.find((o) => o.id === draft.signature_id);
  const previewH = resolveSizePx({ size_preset: draft.size_preset as SizePreset, size_px: draft.size_px as number });

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold text-base">{slot.label}</div>
          <div className="text-xs text-muted-foreground">key: {slot.role}</div>
        </div>
        <Button
          size="sm"
          onClick={() => onSave({
            role: slot.role,
            render_mode: draft.render_mode as RenderMode,
            align: draft.align as AlignMode,
            offset_x_mm: Number(draft.offset_x_mm) || 0,
            offset_y_mm: Number(draft.offset_y_mm) || 0,
            size_preset: draft.size_preset as SizePreset,
            size_px: Number(draft.size_px) || 40,
            show_comment_line: !!draft.show_comment_line,
            signature_id: draft.signature_id || null,
            override_name: (draft.override_name as string)?.trim() || null,
            override_position: (draft.override_position as string)?.trim() || null,
          })}
        >
          <Save className="w-3.5 h-3.5 mr-1" /> บันทึก
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">เลือกผู้ลงนาม (ผูก director_signatures)</Label>
            <Select
              value={draft.signature_id || "__auto__"}
              onValueChange={(v) => setDraft((d) => ({ ...d, signature_id: v === "__auto__" ? null : v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__auto__">— อัตโนมัติจากกฎ keyword —</SelectItem>
                {signatureOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} · {s.position}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">โหมดแสดงผล</Label>
              <Select
                value={draft.render_mode as RenderMode}
                onValueChange={(v) => setDraft((d) => ({ ...d, render_mode: v as RenderMode }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(RENDER_LABEL) as RenderMode[]).map((m) => (
                    <SelectItem key={m} value={m}>{RENDER_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">จัดวาง</Label>
              <Select
                value={draft.align as AlignMode}
                onValueChange={(v) => setDraft((d) => ({ ...d, align: v as AlignMode }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">ซ้าย</SelectItem>
                  <SelectItem value="center">กลาง</SelectItem>
                  <SelectItem value="right">ขวา</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">เยื้อง X (mm)</Label>
              <Input type="number" step="0.5" value={draft.offset_x_mm as number}
                onChange={(e) => setDraft((d) => ({ ...d, offset_x_mm: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">เยื้อง Y (mm)</Label>
              <Input type="number" step="0.5" value={draft.offset_y_mm as number}
                onChange={(e) => setDraft((d) => ({ ...d, offset_y_mm: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">ขนาด (preset)</Label>
              <Select
                value={draft.size_preset as SizePreset}
                onValueChange={(v) => setDraft((d) => ({ ...d, size_preset: v as SizePreset }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">เล็ก (~28px)</SelectItem>
                  <SelectItem value="md">กลาง (~40px)</SelectItem>
                  <SelectItem value="lg">ใหญ่ (~60px)</SelectItem>
                  <SelectItem value="custom">กำหนดเอง</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ความสูง (px) เมื่อ custom</Label>
              <Input type="number" min={16} max={200} value={draft.size_px as number}
                disabled={draft.size_preset !== "custom"}
                onChange={(e) => setDraft((d) => ({ ...d, size_px: parseInt(e.target.value) || 40 }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Override ชื่อ (ทับค่าอัตโนมัติ)</Label>
              <Input value={(draft.override_name as string) || ""}
                onChange={(e) => setDraft((d) => ({ ...d, override_name: e.target.value }))}
                placeholder="เว้นว่างเพื่อใช้ค่าอัตโนมัติ" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Override ตำแหน่ง</Label>
              <Input value={(draft.override_position as string) || ""}
                onChange={(e) => setDraft((d) => ({ ...d, override_position: e.target.value }))}
                placeholder={slot.defaultPosition} />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Switch checked={!!draft.show_comment_line}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, show_comment_line: v }))} />
            <Label className="text-xs">แสดงบรรทัด "ความคิดเห็น" เหนือลายเซ็น</Label>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg border bg-white p-4">
          <div className="text-[11px] text-muted-foreground mb-2">ตัวอย่างการเรนเดอร์ (คงที่ทุกอุปกรณ์)</div>
          <div style={{
            textAlign: draft.align as any,
            marginLeft: `${Number(draft.offset_x_mm) || 0}mm`,
            marginTop: `${Number(draft.offset_y_mm) || 0}mm`,
          }}>
            {draft.show_comment_line && (
              <div className="text-[12px] text-neutral-800 mb-1"
                style={{ textAlign: "left" }}>
                ความคิดเห็น ................................................................
              </div>
            )}
            <div style={{ height: previewH, display: "flex", alignItems: "flex-end", justifyContent: draft.align === "left" ? "flex-start" : draft.align === "right" ? "flex-end" : "center" }}>
              {draft.render_mode === "image" && selected?.url && (
                <img src={selected.url} alt="" style={{ maxHeight: previewH, maxWidth: 200, objectFit: "contain" }} />
              )}
              {draft.render_mode === "image" && !selected?.url && (
                <span className="text-[11px] italic text-muted-foreground">(ยังไม่เลือกลายเซ็น → auto)</span>
              )}
              {draft.render_mode === "blank" && (
                <span className="text-[12px] text-neutral-500">— เส้นว่างเท่านั้น —</span>
              )}
              {draft.render_mode === "name_only" && (
                <span className="text-[13px] font-semibold">{(draft.override_name as string) || selected?.name || "(ชื่อผู้ลงนาม)"}</span>
              )}
            </div>
            <div className="text-[12px]">ลงชื่อ ................................................</div>
            <div className="text-[12px] font-semibold">({(draft.override_name as string) || selected?.name || ".........................................."})</div>
            <div className="text-[12px] text-neutral-700">
              {(draft.override_position as string) || selected?.position || slot.defaultPosition}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function TeachingReflectionSigSettingsPage() {
  const { data: sigs = [] } = useAllSignatures();
  const { data: settingsMap = {} as any, isLoading } = useReflectionSigSettings();
  const update = useUpdateReflectionSigSetting();

  const signatureOptions = useMemo(
    () => sigs.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name, position: s.position, url: s.signature_url })),
    [sigs],
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> กลับ</Button></Link>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <FileSignature className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">ตั้งค่าจุดลายเซ็น — บันทึกหลังการสอน</h1>
            <p className="text-sm text-muted-foreground">
              กำหนดผู้ลงนาม, ขนาด, ตำแหน่งจัดวาง และโหมดแสดงผลของลายเซ็นแต่ละจุด — ระบบเรนเดอร์แบบ mm/px คงที่ทุกอุปกรณ์และตรงกับ PDF ที่พิมพ์จริง
            </p>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : (
        <div className="space-y-4">
          {SLOTS.map((slot) => (
            <SlotRow
              key={slot.role}
              slot={slot}
              value={(settingsMap as any)[slot.role]}
              signatureOptions={signatureOptions}
              onSave={(v) => update.mutate(v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
