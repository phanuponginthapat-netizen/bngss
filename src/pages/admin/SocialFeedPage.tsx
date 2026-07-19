import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, Plus, Trash2, Pencil, ExternalLink, GripVertical, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import {
  SOCIAL_PLATFORMS, PLATFORM_ORDER, detectPlatform,
  type SocialLink, type SocialPlatformKey,
} from "@/lib/socialPlatforms";
import { SocialWallWidget } from "@/components/social/SocialWallWidget";

const emptyLink = (): SocialLink => ({
  id: crypto.randomUUID(),
  platform: "facebook",
  label: "",
  url: "",
  handle: "",
  active: true,
});

export default function SocialFeedPage() {
  const { links, loading, save } = useSocialLinks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SocialLink | null>(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setEditing(emptyLink()); setDialogOpen(true); };
  const openEdit = (l: SocialLink) => { setEditing({ ...l }); setDialogOpen(true); };

  const handleSaveOne = async () => {
    if (!editing) return;
    if (!editing.url.trim()) { toast.error("กรุณากรอก URL"); return; }
    setSaving(true);
    const exists = links.some((l) => l.id === editing.id);
    const next = exists
      ? links.map((l) => (l.id === editing.id ? editing : l))
      : [...links, editing];
    const { error } = await save(next);
    setSaving(false);
    if (error) toast.error("บันทึกไม่สำเร็จ: " + error.message);
    else { toast.success("บันทึกแล้ว"); setDialogOpen(false); }
  };

  const handleDelete = async (id: string) => {
    if (!(await swal.confirm({ title: "ลบลิงค์นี้?", danger: true }))) return;
    const { error } = await save(links.filter((l) => l.id !== id));
    if (error) toast.error(error.message); else toast.success("ลบแล้ว");
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = links.findIndex((l) => l.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= links.length) return;
    const next = [...links];
    [next[idx], next[target]] = [next[target], next[idx]];
    await save(next);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await save(links.map((l) => (l.id === id ? { ...l, active } : l)));
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" />
            Social Wall · ช่องทางติดตาม
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            เพิ่มลิงค์เพจ Social Media ต่างๆ ของโรงเรียน แสดงเป็นการ์ดสวยงามบน Dashboard และหน้าเว็บ
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" /> เพิ่มลิงค์
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          แค่วาง <b>ลิงค์เพจ</b> ก็ใช้งานได้ทันที ไม่ต้องขอ API Token ให้ยุ่งยาก · รองรับ Facebook, YouTube, TikTok, Instagram, LINE, X, LinkedIn, Telegram, Threads, GitHub และเว็บไซต์
        </AlertDescription>
      </Alert>

      {/* จัดการลิงค์ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายการลิงค์ ({links.length})</CardTitle>
          <CardDescription>ลากลำดับ, ซ่อน/แสดง หรือแก้ไขได้</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-8">กำลังโหลด…</div>
          ) : links.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-10">
              ยังไม่มีลิงค์ — กด <b>"เพิ่มลิงค์"</b> ด้านบน
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((l, idx) => {
                const meta = SOCIAL_PLATFORMS[l.platform] ?? SOCIAL_PLATFORMS.website;
                const Icon = meta.icon;
                return (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-col opacity-40">
                      <button onClick={() => move(l.id, -1)} disabled={idx === 0} className="hover:opacity-100 disabled:opacity-20">
                        <GripVertical className="h-3 w-3" />
                      </button>
                    </div>
                    <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-5 w-5 text-white" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{l.label || meta.label}</div>
                      <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground truncate hover:text-primary flex items-center gap-1">
                        <span className="truncate">{l.url}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </div>
                    <Switch
                      checked={l.active !== false}
                      onCheckedChange={(v) => toggleActive(l.id, v)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => openEdit(l)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(l.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ตัวอย่าง */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ตัวอย่างการแสดงผล</CardTitle>
          <CardDescription>แบบที่ผู้ใช้เห็นบน Dashboard / หน้าเว็บ</CardDescription>
        </CardHeader>
        <CardContent>
          <SocialWallWidget variant="bare" />
        </CardContent>
      </Card>

      {/* Dialog เพิ่ม/แก้ไข */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing && links.some((l) => l.id === editing.id) ? "แก้ไขลิงค์" : "เพิ่มลิงค์ใหม่"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL / ลิงค์เพจ *</Label>
                <Input
                  value={editing.url}
                  onChange={(e) => {
                    const url = e.target.value;
                    const auto = detectPlatform(url);
                    setEditing({ ...editing, url, platform: auto });
                  }}
                  placeholder={SOCIAL_PLATFORMS[editing.platform].placeholder}
                />
                <p className="text-xs text-muted-foreground">ระบบจะตรวจจับแพลตฟอร์มให้อัตโนมัติ</p>
              </div>

              <div className="space-y-2">
                <Label>แพลตฟอร์ม</Label>
                <Select value={editing.platform} onValueChange={(v) => setEditing({ ...editing, platform: v as SocialPlatformKey })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORM_ORDER.map((k) => {
                      const m = SOCIAL_PLATFORMS[k];
                      const I = m.icon;
                      return (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-2">
                            <I className="h-4 w-4" style={{ color: m.color }} />
                            {m.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>ชื่อที่แสดง</Label>
                  <Input
                    value={editing.label || ""}
                    onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                    placeholder={SOCIAL_PLATFORMS[editing.platform].label}
                  />
                </div>
                <div className="space-y-2">
                  <Label>@handle (ไม่บังคับ)</Label>
                  <Input
                    value={editing.handle || ""}
                    onChange={(e) => setEditing({ ...editing, handle: e.target.value })}
                    placeholder="@school"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={editing.active !== false}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
                <Label>เปิดใช้งาน (แสดงบนเว็บ)</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSaveOne} disabled={saving}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
