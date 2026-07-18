import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Shuffle, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  MASCOT_STYLES, BG_COLORS, AVATAAARS_OPTIONS, MascotConfig, buildMascotUrl, useUserMascot,
} from "@/hooks/useUserMascot";

interface Props {
  userId?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const HAIR_COLORS = ["0e0e0e", "5b3a1d", "a55728", "c93305", "d6b370", "e8e1e1"];
const SKIN_COLORS = ["f2d3b1", "edb98a", "d08b5b", "ae5d29", "694d3d"];

export default function MascotBuilder({ userId, open, onOpenChange }: Props) {
  const { config: saved, save, clear } = useUserMascot(userId);
  const [cfg, setCfg] = useState<MascotConfig>({
    style: "avataaars",
    seed: "MySchool",
    backgroundColor: "b6e3f4",
    hairColor: "5b3a1d",
    skinColor: "f2d3b1",
    flip: false,
    scale: 100,
    top: "shortHairShortFlat",
    accessories: "blank",
    facialHair: "blank",
    clothing: "hoodie",
    eyes: "happy",
    eyebrows: "default",
    mouth: "smile",
  });

  useEffect(() => {
    if (saved) setCfg({ ...cfg, ...saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, open]);

  const set = <K extends keyof MascotConfig>(k: K, v: MascotConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const randomize = () => set("seed", Math.random().toString(36).slice(2, 10));

  const previewUrl = buildMascotUrl(cfg, "happy");
  const moods: Array<"happy" | "neutral" | "worried"> = ["happy", "neutral", "worried"];

  const handleSave = async () => {
    try { await save(cfg); toast.success("บันทึกมาสคอทของคุณแล้ว 🎉"); onOpenChange(false); }
    catch (e: any) { toast.error(e.message || "บันทึกไม่สำเร็จ"); }
  };
  const handleClear = async () => {
    try { await clear(); toast.success("ใช้มาสคอทค่าเริ่มต้น"); onOpenChange(false); }
    catch (e: any) { toast.error(e.message || "ล้างไม่สำเร็จ"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> ออกแบบมาสคอทของคุณ
          </DialogTitle>
          <DialogDescription>
            เลือกหน้า ผม สี และรูปร่าง ให้เป็น signature ของคุณเอง ระบบจะใช้แสดงบนแดชบอร์ดของคุณ
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="space-y-3">
            <div className="aspect-square rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/10 flex items-center justify-center overflow-hidden">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-4" />
              ) : <div className="text-muted-foreground">เลือกค่าเพื่อดูตัวอย่าง</div>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {moods.map((m) => (
                <div key={m} className="rounded-lg border bg-card p-2">
                  <img src={buildMascotUrl(cfg, m)} alt={m} className="w-full aspect-square object-contain" />
                  <div className="text-[10px] text-center text-muted-foreground mt-1">{m === "happy" ? "ดีใจ" : m === "neutral" ? "ปกติ" : "กังวล"}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div>
              <Label className="text-xs">สไตล์</Label>
              <Select value={cfg.style} onValueChange={(v) => set("style", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {MASCOT_STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">ชื่อ/Seed (เปลี่ยนเพื่อสุ่มหน้า)</Label>
              <div className="flex gap-2">
                <Input value={cfg.seed} onChange={(e) => set("seed", e.target.value)} />
                <Button type="button" variant="outline" size="icon" onClick={randomize}><Shuffle className="w-4 h-4" /></Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">สีพื้นหลัง</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {BG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("backgroundColor", c)}
                    className={`w-9 h-9 rounded-full border-2 ${cfg.backgroundColor === c ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                    style={{ background: c === "transparent" ? "repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50% / 10px 10px" : `#${c}` }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">สีผม</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {HAIR_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => set("hairColor", c)}
                    className={`w-8 h-8 rounded-full border-2 ${cfg.hairColor === c ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                    style={{ background: `#${c}` }} />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">สีผิว</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {SKIN_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => set("skinColor", c)}
                    className={`w-8 h-8 rounded-full border-2 ${cfg.skinColor === c ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                    style={{ background: `#${c}` }} />
                ))}
              </div>
            </div>

            {cfg.style === "avataaars" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t">
                {([
                  ["top", "ทรงผม/หมวก"],
                  ["accessories", "แว่นตา"],
                  ["facialHair", "หนวด/เครา"],
                  ["clothing", "เสื้อผ้า"],
                  ["eyes", "ดวงตา"],
                  ["eyebrows", "คิ้ว"],
                  ["mouth", "ปาก"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-[10px]">{label}</Label>
                    <Select value={(cfg as any)[key]} onValueChange={(v) => set(key as any, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {(AVATAAARS_OPTIONS as any)[key].map((o: string) => (
                          <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label className="text-xs">ขนาด ({cfg.scale}%)</Label>
              <Slider value={[cfg.scale ?? 100]} min={60} max={130} step={5} onValueChange={(v) => set("scale", v[0])} />
            </div>


            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-xs">กลับด้าน (Flip)</Label>
              <Switch checked={!!cfg.flip} onCheckedChange={(v) => set("flip", v)} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {saved && (
            <Button variant="ghost" className="text-destructive mr-auto" onClick={handleClear}>
              <Trash2 className="w-4 h-4 mr-1" /> ใช้มาสคอทเริ่มต้น
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSave}>บันทึกเป็นมาสคอทของฉัน</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
