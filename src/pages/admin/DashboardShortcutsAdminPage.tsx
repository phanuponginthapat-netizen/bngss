import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as LucideIcons from "lucide-react";
import { Network, Plus, Trash2, Upload, GripVertical, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";
import { saveErrorMessage } from "@/lib/saveError";

type Shortcut = {
  id: string;
  label_th: string;
  label_en: string;
  icon: string | null;
  logo_url: string | null;
  bg_class: string;
  target_url: string;
  open_in_new_tab: boolean;
  visible_roles: string[];
  sort_order: number;
  is_active: boolean;
};

const ROLES = ["admin", "director", "teacher", "student", "alumni", "parent"];

const BG_PRESETS = [
  "bg-gradient-to-br from-emerald-400 to-teal-600",
  "bg-gradient-to-br from-cyan-400 to-blue-600",
  "bg-gradient-to-br from-amber-400 to-orange-500",
  "bg-gradient-to-br from-lime-400 to-emerald-600",
  "bg-gradient-to-br from-fuchsia-400 to-purple-600",
  "bg-gradient-to-br from-rose-400 to-pink-600",
  "bg-gradient-to-br from-yellow-400 to-amber-500",
  "bg-gradient-to-br from-red-400 to-rose-600",
  "bg-gradient-to-br from-orange-400 to-red-500",
  "bg-gradient-to-br from-green-400 to-emerald-600",
  "bg-gradient-to-br from-indigo-400 to-purple-600",
  "bg-gradient-to-br from-violet-400 to-fuchsia-600",
  "bg-gradient-to-br from-sky-400 to-blue-600",
  "bg-gradient-to-br from-slate-400 to-slate-600",
];

const COMMON_ICONS = [
  "ClipboardList", "ScanFace", "Calendar", "BookOpenCheck", "ClipboardCheck", "Shield", "FileText",
  "Heart", "Megaphone", "Wallet", "Package", "Users", "Inbox", "Network", "Home", "Star", "Award",
  "Globe", "Bell", "Camera", "Bookmark", "Building2", "GraduationCap", "MapPin", "Settings", "Trophy",
  "MessageSquare", "Sparkles", "Gamepad2", "QrCode", "DollarSign", "TrendingUp",
];

function IconPreview({ name, className }: { name: string | null; className?: string }) {
  const Comp = (name && (LucideIcons as any)[name]) || Network;
  return <Comp className={className} />;
}

const empty: Shortcut = {
  id: "",
  label_th: "",
  label_en: "",
  icon: "Star",
  logo_url: null,
  bg_class: BG_PRESETS[0],
  target_url: "/dashboard",
  open_in_new_tab: false,
  visible_roles: [...ROLES],
  sort_order: 999,
  is_active: true,
};

export default function DashboardShortcutsAdminPage() {
  const qc = useQueryClient();
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const [editing, setEditing] = useState<Shortcut | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["dashboard_shortcuts", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_shortcuts")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as Shortcut[]) || [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dashboard_shortcuts"] });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.label_th || !editing.label_en || !editing.target_url) {
      toast.error(L("กรุณากรอกชื่อและ URL", "Please fill name and URL"));
      return;
    }
    const payload = { ...editing };
    if (!payload.id) {
      const { id, ...insert } = payload;
      const { error } = await supabase.from("dashboard_shortcuts").insert(insert as any);
      if (error) return toast.error(saveErrorMessage(error));
      toast.success(L("เพิ่มปุ่มแล้ว", "Added"));
    } else {
      const { id, ...update } = payload;
      const { error } = await supabase.from("dashboard_shortcuts").update(update).eq("id", id);
      if (error) return toast.error(saveErrorMessage(error));
      toast.success(L("บันทึกแล้ว", "Saved"));
    }
    setEditing(null);
    invalidate();
  };

  const del = async (id: string) => {
    if (!confirm(L("ลบปุ่มนี้?", "Delete this shortcut?"))) return;
    const { error } = await supabase.from("dashboard_shortcuts").delete().eq("id", id);
    if (error) return toast.error(saveErrorMessage(error));
    toast.success(L("ลบแล้ว", "Deleted"));
    invalidate();
  };

  const toggleActive = async (s: Shortcut) => {
    const { error } = await supabase
      .from("dashboard_shortcuts")
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
    if (error) return toast.error(saveErrorMessage(error));
    invalidate();
  };

  const move = async (s: Shortcut, dir: -1 | 1) => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const i = sorted.findIndex((x) => x.id === s.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    await supabase.from("dashboard_shortcuts").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("dashboard_shortcuts").update({ sort_order: a.sort_order }).eq("id", b.id);
    invalidate();
  };

  const uploadLogo = async (file: File) => {
    if (!editing) return;
    if (!file.type.startsWith("image/")) {
      toast.error(L("ต้องเป็นไฟล์รูปภาพ", "Must be an image"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(L("ไฟล์ต้องไม่เกิน 2MB", "Max 2MB"));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `dashboard-shortcuts/${crypto.randomUUID()}.${ext}`;
      const result = await uploadPublicFileWithFallback("cms-images", path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      setEditing({ ...editing, logo_url: result.publicUrl });
      toast.success(L("อัปโหลดโลโก้แล้ว", "Logo uploaded"));
    } catch (e: any) {
      toast.error(e.message || String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{L("ปุ่มลัดหน้า Dashboard", "Dashboard Shortcuts")}</h1>
          <p className="text-sm text-muted-foreground">
            {L("จัดการปุ่มลัด: ชื่อ ไอคอน โลโก้ URL ปลายทาง และบทบาทที่มองเห็น",
               "Manage shortcut tiles: name, icon, logo, target URL, visible roles")}
          </p>
        </div>
        <Button onClick={() => setEditing({ ...empty, sort_order: (items.at(-1)?.sort_order ?? 0) + 10 })}>
          <Plus className="w-4 h-4 mr-1" /> {L("เพิ่มปุ่ม", "Add Shortcut")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{L("รายการปุ่มลัด", "Shortcuts")} ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">{L("ยังไม่มีปุ่มลัด", "No shortcuts yet.")}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition ${s.is_active ? "" : "opacity-60"}`}
                >
                  <div className="flex flex-col">
                    <button onClick={() => move(s, -1)} className="text-muted-foreground hover:text-foreground text-xs">▲</button>
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <button onClick={() => move(s, 1)} className="text-muted-foreground hover:text-foreground text-xs">▼</button>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl ${s.bg_class} flex items-center justify-center overflow-hidden ring-1 ring-black/5 shrink-0`}>
                    {s.logo_url ? (
                      <img loading="lazy" decoding="async" src={s.logo_url} alt="" className="w-full h-full object-contain p-1.5" />
                    ) : (
                      <IconPreview name={s.icon} className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{s.label_th}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.label_en} · {s.target_url}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.visible_roles.map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px] py-0 px-1.5">{r}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                        {L("แก้ไข", "Edit")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => del(s.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? L("แก้ไขปุ่มลัด", "Edit Shortcut") : L("เพิ่มปุ่มลัด", "Add Shortcut")}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                <div className={`w-16 h-16 rounded-2xl ${editing.bg_class} flex items-center justify-center overflow-hidden ring-1 ring-black/5`}>
                  {editing.logo_url ? (
                    <img loading="lazy" decoding="async" src={editing.logo_url} alt="" className="w-full h-full object-contain p-2" />
                  ) : (
                    <IconPreview name={editing.icon} className="w-8 h-8 text-white" />
                  )}
                </div>
                <div>
                  <div className="font-medium">{editing.label_th || "—"}</div>
                  <div className="text-xs text-muted-foreground">{editing.label_en || "—"}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{L("ชื่อ (ไทย)", "Label (TH)")}</Label>
                  <Input value={editing.label_th} onChange={(e) => setEditing({ ...editing, label_th: e.target.value })} />
                </div>
                <div>
                  <Label>{L("ชื่อ (อังกฤษ)", "Label (EN)")}</Label>
                  <Input value={editing.label_en} onChange={(e) => setEditing({ ...editing, label_en: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>{L("URL ปลายทาง", "Target URL")}</Label>
                <Input
                  placeholder="/dashboard/... หรือ https://..."
                  value={editing.target_url}
                  onChange={(e) => setEditing({ ...editing, target_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {L("ขึ้นต้นด้วย / = ภายในระบบ, http(s):// = เว็บภายนอก",
                     "Start with / for internal routes, http(s):// for external")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.open_in_new_tab}
                  onCheckedChange={(v) => setEditing({ ...editing, open_in_new_tab: v })}
                />
                <Label>{L("เปิดในแท็บใหม่", "Open in new tab")}</Label>
              </div>

              <div>
                <Label>{L("ไอคอน (Lucide)", "Icon (Lucide)")}</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="เช่น Star, Heart, Calendar"
                    value={editing.icon || ""}
                    onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                  />
                  <div className={`w-10 h-10 rounded-lg ${editing.bg_class} flex items-center justify-center`}>
                    <IconPreview name={editing.icon} className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {COMMON_ICONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setEditing({ ...editing, icon: n })}
                      className={`p-1.5 rounded border hover:bg-muted ${editing.icon === n ? "bg-primary/10 border-primary" : ""}`}
                      title={n}
                    >
                      <IconPreview name={n} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
                <a
                  href="https://lucide.dev/icons/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline mt-1 inline-block"
                >
                  {L("ดูไอคอนทั้งหมด (lucide.dev)", "Browse all icons (lucide.dev)")}
                </a>
              </div>

              <div>
                <Label>{L("โลโก้ PNG (ใช้แทนไอคอน)", "Logo PNG (overrides icon)")}</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadLogo(f);
                    }}
                    disabled={uploading}
                  />
                  {editing.logo_url && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, logo_url: null })}>
                      <X className="w-4 h-4" /> {L("ลบโลโก้", "Remove")}
                    </Button>
                  )}
                </div>
                {editing.logo_url && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{editing.logo_url}</p>
                )}
              </div>

              <div>
                <Label>{L("สีพื้นหลัง", "Background")}</Label>
                <div className="grid grid-cols-7 gap-2 mt-1">
                  {BG_PRESETS.map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setEditing({ ...editing, bg_class: bg })}
                      className={`h-10 rounded-lg ${bg} ring-2 ${editing.bg_class === bg ? "ring-primary" : "ring-transparent"}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label>{L("บทบาทที่มองเห็น", "Visible to roles")}</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ROLES.map((r) => {
                    const on = editing.visible_roles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            visible_roles: on
                              ? editing.visible_roles.filter((x) => x !== r)
                              : [...editing.visible_roles, r],
                          })
                        }
                        className={`px-3 py-1 rounded-full text-xs border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{L("ลำดับ", "Sort order")}</Label>
                  <Input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Switch
                    checked={editing.is_active}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                  <Label>{L("เปิดใช้งาน", "Active")}</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {L("ยกเลิก", "Cancel")}
            </Button>
            <Button onClick={save} disabled={uploading}>
              <Save className="w-4 h-4 mr-1" /> {L("บันทึก", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
