import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { compressImage } from "@/lib/imageCompress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";
import {
  Plus, Pencil, Trash2, FileText, Menu as MenuIcon, Settings, Image as ImageIcon,
  Upload, Palette, Eye, Home, Code2, MapPin, Building2, Sparkles, ImagePlus, Smartphone, LayoutPanelTop, Package, Bot
} from "lucide-react";
import RichTextEditor from "@/components/cms/RichTextEditor";
import FullHtmlEditor from "@/components/cms/FullHtmlEditor";
import HomepageEditor from "@/components/cms/HomepageEditor";
import ConfigBackupCard from "@/components/admin/ConfigBackupCard";
import { cn } from "@/lib/utils";
import { swal } from "@/lib/swal";
import { saveErrorMessage } from "@/lib/saveError";

// ---- Pages Tab with Rich Editor ----
const PagesTab = () => {
  const [pages, setPages] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPage, setEditPage] = useState<any>(null);
  const [form, setForm] = useState({ slug: "", title: "", content: "", is_published: false, sort_order: 0, is_full_html: false });
  const [saving, setSaving] = useState(false);

  const fetchPages = async () => {
    const { data } = await supabase.from("cms_pages").select("*").order("sort_order");
    if (data) setPages(data);
  };
  useEffect(() => { fetchPages(); }, []);

  const openAdd = () => { setEditPage(null); setForm({ slug: "", title: "", content: "", is_published: false, sort_order: 0, is_full_html: false }); setDialogOpen(true); };
  const openEdit = (p: any) => { setEditPage(p); setForm({ slug: p.slug, title: p.title, content: p.content || "", is_published: p.is_published, sort_order: p.sort_order, is_full_html: p.content?.startsWith("<!") || p.content?.startsWith("<html") || false }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.slug?.trim() || !form.title?.trim()) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    if (saving) return;
    setSaving(true);
    const { is_full_html, ...dbForm } = form;
    try {
      if (editPage) {
        const { error } = await supabase.from("cms_pages").update(dbForm).eq("id", editPage.id);
        if (error) { toast.error(saveErrorMessage(error)); return; }
        toast.success("แก้ไขหน้าสำเร็จ");
      } else {
        const { error } = await supabase.from("cms_pages").insert(dbForm);
        if (error) { toast.error(saveErrorMessage(error)); return; }
        toast.success("เพิ่มหน้าสำเร็จ");
      }
      setDialogOpen(false);
      fetchPages();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await swal.confirm({ title: "ยืนยันการลบหน้านี้?", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("cms_pages").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("ลบสำเร็จ");
    fetchPages();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">จัดการหน้าเว็บ</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-1" /> เพิ่มหน้า</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editPage ? "แก้ไขหน้า" : "เพิ่มหน้าใหม่"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Slug (URL)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="about" /></div>
                <div className="space-y-1.5"><Label>ชื่อหน้า</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>ลำดับ</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>เนื้อหา</Label>
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-xs cursor-pointer">โหมดเต็มหน้า (Full HTML)</Label>
                    <Switch checked={form.is_full_html} onCheckedChange={(v) => setForm({ ...form, is_full_html: v })} />
                  </div>
                </div>
                {form.is_full_html ? (
                  <FullHtmlEditor content={form.content} onChange={(html) => setForm({ ...form, content: html })} />
                ) : (
                  <RichTextEditor content={form.content} onChange={(html) => setForm({ ...form, content: html })} />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
                <Label>เผยแพร่</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slug</TableHead><TableHead>ชื่อ</TableHead><TableHead>สถานะ</TableHead><TableHead>ลำดับ</TableHead><TableHead className="text-right">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map(p => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">/{p.slug}</TableCell>
              <TableCell className="font-medium">{p.title}</TableCell>
              <TableCell>{p.is_published ? <span className="text-green-600 text-xs font-semibold">เผยแพร่</span> : <span className="text-muted-foreground text-xs">ฉบับร่าง</span>}</TableCell>
              <TableCell>{p.sort_order}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// ---- Menu Tab ----
const MenuTab = () => {
  const [items, setItems] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ label: "", url: "", sort_order: 0, is_visible: true });
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    const { data } = await supabase.from("cms_menu_items").select("*").order("sort_order");
    if (data) setItems(data);
  };
  useEffect(() => { fetchItems(); }, []);

  const openAdd = () => { setEditItem(null); setForm({ label: "", url: "", sort_order: 0, is_visible: true }); setDialogOpen(true); };
  const openEdit = (m: any) => { setEditItem(m); setForm({ label: m.label, url: m.url || "", sort_order: m.sort_order, is_visible: m.is_visible }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.label?.trim()) { toast.error("กรุณากรอกชื่อเมนู"); return; }
    if (saving) return;
    setSaving(true);
    try {
      if (editItem) {
        const { error } = await supabase.from("cms_menu_items").update(form).eq("id", editItem.id);
        if (error) { toast.error(saveErrorMessage(error)); return; }
      } else {
        const { error } = await supabase.from("cms_menu_items").insert(form);
        if (error) { toast.error(saveErrorMessage(error)); return; }
      }
      toast.success("บันทึกสำเร็จ");
      setDialogOpen(false);
      fetchItems();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await swal.confirm({ title: "ยืนยันการลบเมนูนี้?", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("cms_menu_items").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("ลบสำเร็จ");
    fetchItems();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">จัดการเมนู</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-1" /> เพิ่มเมนู</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editItem ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5"><Label>ชื่อเมนู</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="/page/about" /></div>
              <div className="space-y-1.5"><Label>ลำดับ</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_visible} onCheckedChange={(v) => setForm({ ...form, is_visible: v })} /><Label>แสดงผล</Label></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ชื่อเมนู</TableHead><TableHead>URL</TableHead><TableHead>ลำดับ</TableHead><TableHead>แสดง</TableHead><TableHead className="text-right">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(m => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.label}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{m.url}</TableCell>
              <TableCell>{m.sort_order}</TableCell>
              <TableCell>{m.is_visible ? "✓" : "—"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// ---- Shared settings hook ----
type SettingsMap = Record<string, { id: string; value: string }>;

const useCmsSettings = () => {
  const qc = useQueryClient();
  const [settings, setSettings] = useState<SettingsMap>({});
  const fetchSettings = async () => {
    const { data } = await supabase.from("cms_settings").select("*");
    if (data) {
      const map: SettingsMap = {};
      data.forEach((s: any) => { map[s.key] = { id: s.id, value: s.value || "" }; });
      setSettings(map);
    }
  };
  useEffect(() => { fetchSettings(); }, []);
  const updateSetting = (key: string, value: string) =>
    setSettings(prev => ({ ...prev, [key]: { ...(prev[key] || { id: "" }), value } }));
  const ensureSetting = async (key: string, value: string) => {
    if (settings[key]?.id) {
      const { error } = await supabase.from("cms_settings").update({ value }).eq("id", settings[key].id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("cms_settings").insert({ key, value });
      if (error) throw error;
    }
  };
  const saveAll = async () => {
    try {
      for (const [key, s] of Object.entries(settings)) {
        if (s.id) {
          const { error } = await supabase.from("cms_settings").update({ value: s.value }).eq("id", s.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("cms_settings").insert({ key, value: s.value });
          if (error) throw error;
        }
      }
      toast.success("บันทึกการตั้งค่าสำเร็จ");
      await qc.invalidateQueries({ queryKey: ["cms_settings_bulk"] });
      try { localStorage.removeItem("cms_settings_bulk_v1"); } catch { /* noop */ }
      fetchSettings();
    } catch (e: any) {
      toast.error(`บันทึกไม่สำเร็จ: ${e?.message || e}`);
    }
  };
  const uploadImage = async (file: File, prefix: string, key: string, successText = 'อัปโหลดสำเร็จ') => {
    // Preserve animation for GIFs — do not re-encode
    const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
    const payload: Blob = isGif ? file : await compressImage(file, { maxWidth: 1600, maxSizeKB: 200 });
    const result = await uploadPublicFileWithFallback('cms-images', `${prefix}_${Date.now()}_${file.name}`, payload);
    updateSetting(key, result.publicUrl);
    await ensureSetting(key, result.publicUrl);
    toast.success(result.usedFallback ? 'เพิ่มรูปสำเร็จ (โหมดสำรอง)' : successText);
    fetchSettings();
  };
  return { settings, updateSetting, saveAll, uploadImage };
};

const SaveBar = ({ onSave }: { onSave: () => void | Promise<void> }) => {
  const [saving, setSaving] = useState(false);
  const handleClick = async () => {
    if (saving) return;
    setSaving(true);
    try { await onSave(); } finally { setSaving(false); }
  };
  return (
    <div className="pt-2">
      <Button onClick={handleClick} disabled={saving}>
        {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
      </Button>
    </div>
  );
};

// ---- Section: ข้อมูลโรงเรียน ----
const IdentitySection = () => {
  const { settings, updateSetting, saveAll } = useCmsSettings();
  const [schoolRow, setSchoolRow] = useState<any>(null);
  const [obecCode, setObecCode] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [savingCodes, setSavingCodes] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("schools")
        .select("id, school_code, obec_code")
        .limit(1).maybeSingle();
      if (data) {
        setSchoolRow(data);
        setObecCode(data.obec_code || "");
        setSchoolCode(data.school_code || "");
      }
    })();
  }, []);

  const saveCodes = async () => {
    if (obecCode && !/^\d{8,10}$/.test(obecCode)) { toast.error("รหัส OBEC ต้องเป็นตัวเลข 8-10 หลัก"); return; }
    if (!obecCode && !schoolCode) { toast.error("กรุณากรอกรหัส OBEC หรือรหัสโรงเรียนอย่างน้อย 1 อย่าง"); return; }
    setSavingCodes(true);
    try {
      if (schoolRow?.id) {
        const { error } = await supabase.from("schools")
          .update({ obec_code: obecCode || null, school_code: schoolCode || obecCode })
          .eq("id", schoolRow.id);
        if (error) throw error;
      } else {
        // No school row yet — auto-create one. Pull display name from cms_settings.
        const { data: nameSetting } = await supabase
          .from("cms_settings").select("value").eq("key", "school_name").maybeSingle();
        const school_name = (nameSetting?.value as string) || "โรงเรียน";
        const code = schoolCode || obecCode;
        const { data: inserted, error } = await supabase.from("schools")
          .insert({ school_code: code, obec_code: obecCode || null, school_name })
          .select("id, school_code, obec_code").single();
        if (error) throw error;
        setSchoolRow(inserted);
      }
      toast.success("บันทึกรหัสโรงเรียนเรียบร้อย — จะถูกใช้ใน District Feed API ทันที");
    } catch (e: any) {
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || ""));
    } finally {
      setSavingCodes(false);
    }
  };

  const fields = [
    { key: "school_name", label: "ชื่อโรงเรียน" },
    { key: "hero_title", label: "ชื่อหลัก (Hero Title)" },
    { key: "hero_subtitle", label: "คำอธิบาย (Subtitle)" },
    { key: "school_address", label: "ที่อยู่" },
    { key: "school_phone", label: "เบอร์โทร" },
    { key: "school_email", label: "อีเมล" },
    { key: "director_name", label: "ชื่อผู้อำนวยการ" },
    { key: "director_title", label: "ตำแหน่งผู้อำนวยการ" },
  ];
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Building2 className="w-5 h-5 text-primary" /> ข้อมูลโรงเรียน
      </h3>
      <div className="grid gap-4 max-w-2xl">
        {fields.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <Label className="text-right text-sm">{label}</Label>
            <Input className="col-span-2" value={settings[key]?.value || ""} onChange={(e) => updateSetting(key, e.target.value)} />
          </div>
        ))}
      </div>
      <SaveBar onSave={saveAll} />

      {/* รหัสประจำตัวสำหรับระบบส่วนกลาง / Hub */}
      <div className="border-t pt-6 space-y-4 max-w-2xl">
        <div>
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> รหัสประจำโรงเรียน (ใช้กับระบบส่วนกลาง / Hub เขต)
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            รหัสเหล่านี้จะถูกส่งออกผ่าน <code className="px-1 bg-muted rounded">District Feed API</code> ให้เขต/สพฐ. ใช้ระบุโรงเรียน
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <Label className="text-right text-sm">รหัส OBEC (10 หลัก) <span className="text-destructive">*</span></Label>
          <Input
            className="col-span-2 font-mono"
            value={obecCode}
            onChange={(e) => setObecCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="เช่น 1010720001"
            inputMode="numeric"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <Label className="text-right text-sm">รหัสโรงเรียน (สมศ./อื่นๆ)</Label>
          <Input
            className="col-span-2 font-mono"
            value={schoolCode}
            onChange={(e) => setSchoolCode(e.target.value)}
            placeholder="เช่น 1072450123"
          />
        </div>
        <div className="pt-2">
          <Button onClick={saveCodes} disabled={savingCodes}>
            {savingCodes ? "กำลังบันทึก..." : "บันทึกรหัสโรงเรียน"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---- Section: โลโก้ & ตรา ----
const BrandingSection = () => {
  const { settings, uploadImage } = useCmsSettings();
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" /> โลโก้โรงเรียน
        </h3>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
            {settings.school_logo?.value ? <img src={settings.school_logo.value} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="w-8 h-8 text-muted-foreground" />}
          </div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return; await uploadImage(f, 'logo', 'school_logo', 'อัปโหลดโลโก้สำเร็จ');
            }} />
            <Button size="sm" variant="outline" asChild><span><Upload className="w-4 h-4 mr-1" /> อัปโหลดโลโก้</span></Button>
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-2">แนะนำ: PNG หรือ SVG ขนาด 200x200 พิกเซลขึ้นไป</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> ตราโรงเรียน / ตราครุฑ (สำหรับเอกสาร)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
          {[
            { key: 'school_seal', label: 'ตราโรงเรียน', prefix: 'seal' },
            { key: 'garuda_emblem', label: 'ตราครุฑ', prefix: 'garuda' },
            { key: 'director_signature', label: 'ลายเซ็นผู้อำนวยการ', prefix: 'signature', hint: 'PNG พื้นหลังโปร่งใส ใช้ลงเอกสารทุกฉบับ' },
          ].map(({ key, label, prefix, hint }: any) => (
            <div key={key}>
              <Label className="text-sm mb-2 block">{label}</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                  {settings[key]?.value ? <img src={settings[key].value} alt={label} className="w-full h-full object-contain" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return; await uploadImage(f, prefix, key);
                  }} />
                  <Button size="sm" variant="outline" asChild><span><Upload className="w-3 h-3 mr-1" /> อัปโหลด</span></Button>
                </label>
              </div>
              {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---- Section: ระบบ & ไอคอน ----
const AppIconSection = () => {
  const { settings, updateSetting, saveAll, uploadImage } = useCmsSettings();
  const fields = [
    { key: "app_name", label: "ชื่อระบบ (Tab เบราว์เซอร์)", placeholder: "Smart Management System" },
    { key: "app_short_name", label: "ชื่อย่อ (PWA/มือถือ)", placeholder: "Smart School" },
  ];
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-primary" /> ตั้งค่าระบบ (ชื่อ & ไอคอน)
      </h3>
      <div className="grid gap-4 max-w-2xl">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <Label className="text-right text-sm">{label}</Label>
            <Input className="col-span-2" value={settings[key]?.value || ""} onChange={(e) => updateSetting(key, e.target.value)} placeholder={placeholder} />
          </div>
        ))}
      </div>
      <div>
        <Label className="text-sm mb-2 block">ไอคอนระบบ (Favicon / PWA Icon)</Label>
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
            {settings.app_favicon_url?.value ? <img src={settings.app_favicon_url.value} alt="Favicon" className="w-full h-full object-contain" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
          </div>
          <label className="cursor-pointer">
            <input type="file" accept="image/png,image/svg+xml" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return; await uploadImage(f, 'favicon', 'app_favicon_url', 'อัปโหลดไอคอนสำเร็จ');
            }} />
            <Button size="sm" variant="outline" asChild><span><Upload className="w-4 h-4 mr-1" /> อัปโหลดไอคอน</span></Button>
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-2">แนะนำ: PNG ขนาด 192x192 หรือ 512x512 พิกเซล</p>
      </div>
      <SaveBar onSave={saveAll} />
    </div>
  );
};

// ---- Section: ธีมสี ----
const THEME_DEFAULTS: Record<string, string> = {
  theme_primary_color: "#2563eb",
  theme_secondary_color: "#f1f5f9",
  theme_accent_color: "#14b8a6",
  theme_success_color: "#16a34a",
  theme_warning_color: "#f59e0b",
  theme_info_color: "#0ea5e9",
  theme_destructive_color: "#ef4444",
};

// HEX → "H S% L%" สำหรับ shadcn CSS variables (ใช้แสดง live-preview ทันทีระหว่างแก้)
function hexToHslString(hex: string): string | null {
  const m = hex.trim().replace(/^#/, "");
  const h = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hh = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hh = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: hh = ((b - r) / d + 2); break;
      case b: hh = ((r - g) / d + 4); break;
    }
    hh *= 60;
  }
  return `${Math.round(hh)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// map key → CSS variables ที่จะอัปเดตแบบ live
const THEME_VAR_MAP: Record<string, string[]> = {
  theme_primary_color: ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"],
  theme_secondary_color: ["--secondary"],
  theme_accent_color: ["--accent"],
  theme_success_color: ["--success"],
  theme_warning_color: ["--warning"],
  theme_info_color: ["--info"],
  theme_destructive_color: ["--destructive"],
};

type ThemeField = {
  key: string;
  label: string;
  desc: string;
  usage: string;
};

const THEME_FIELDS: ThemeField[] = [
  {
    key: "theme_primary_color",
    label: "สีหลัก (Primary)",
    desc: "สีเอกลักษณ์ของโรงเรียน ใช้กับปุ่มหลัก ลิงก์ ไอคอนสำคัญ",
    usage: "ปุ่มยืนยัน • ลิงก์ • เมนูที่กำลังเปิดใน Sidebar • เส้นขอบ focus",
  },
  {
    key: "theme_secondary_color",
    label: "สีรอง (Secondary)",
    desc: "สีพื้นหลังอ่อน ใช้กับ badge/ปุ่มรอง กล่องเบา ๆ",
    usage: "ปุ่มรอง • Badge • พื้นหลังการ์ดเน้นเล็กน้อย",
  },
  {
    key: "theme_accent_color",
    label: "สีเน้น (Accent)",
    desc: "สีเสริมใช้ตัดกับสีหลัก เพื่อดึงสายตาไปยังจุดเน้น",
    usage: "Hover เมนู • Tag • ไอคอนเสริม • Highlight ข่าว/กิจกรรม",
  },
  {
    key: "theme_success_color",
    label: "สีสำเร็จ (Success)",
    desc: "สีแจ้งสถานะเชิงบวก เช่น มาเรียน อนุมัติ ผ่าน",
    usage: "แจ้งเตือนสำเร็จ • สถานะ 'มาเรียน/อนุมัติ' • กราฟผ่านเกณฑ์",
  },
  {
    key: "theme_warning_color",
    label: "สีเตือน (Warning)",
    desc: "สีเตือนต้องระวัง เช่น สาย รอดำเนินการ ใกล้ครบกำหนด",
    usage: "แจ้งเตือนคำเตือน • สถานะ 'สาย/รออนุมัติ' • กราฟใกล้เกณฑ์",
  },
  {
    key: "theme_info_color",
    label: "สีข้อมูล (Info)",
    desc: "สีสื่อความว่าเป็นข้อมูล/ประกาศทั่วไป",
    usage: "แจ้งข่าวสาร • Badge ข้อมูล • ปุ่ม 'ดูรายละเอียด'",
  },
  {
    key: "theme_destructive_color",
    label: "สีอันตราย (Destructive)",
    desc: "สีสำหรับการกระทำที่มีผลกระทบ เช่น ลบ ปฏิเสธ ขาดเรียน",
    usage: "ปุ่มลบ • สถานะ 'ขาด/ปฏิเสธ' • แจ้งเตือนผิดพลาด",
  },
];

const ThemeColorSection = () => {
  const { settings, updateSetting, saveAll } = useCmsSettings();

  const applyLivePreview = (key: string, value: string) => {
    updateSetting(key, value);
    const hsl = hexToHslString(value);
    if (!hsl) return;
    const root = document.documentElement;
    for (const v of THEME_VAR_MAP[key] || []) root.style.setProperty(v, hsl);
  };

  const resetDefaults = () => {
    for (const k of Object.keys(THEME_DEFAULTS)) applyLivePreview(k, THEME_DEFAULTS[k]);
    toast("รีเซ็ตเป็นค่าเริ่มต้น — กด 'บันทึกการตั้งค่า' เพื่อยืนยัน");
  };

  const getVal = (key: string) => settings[key]?.value || THEME_DEFAULTS[key];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" /> ธีมสี
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            แก้สีจะเห็นผลบนหน้านี้ทันที (live preview) — กด "บันทึกการตั้งค่า" เพื่อให้มีผลทั้งระบบ
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetDefaults}>รีเซ็ตค่าเริ่มต้น</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {THEME_FIELDS.map(({ key, label, desc, usage }) => {
          const val = getVal(key);
          return (
            <div key={key} className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div
                  className="w-14 h-14 rounded-lg border shadow-sm shrink-0 ring-1 ring-black/5"
                  style={{ background: val }}
                  title={val}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={val}
                  onChange={(e) => applyLivePreview(key, e.target.value)}
                  className="w-10 h-10 rounded-md border border-border cursor-pointer"
                />
                <Input
                  value={val}
                  onChange={(e) => applyLivePreview(key, e.target.value)}
                  placeholder={THEME_DEFAULTS[key]}
                  className="flex-1 font-mono text-xs uppercase"
                />
              </div>
              <div className="text-[11px] leading-relaxed text-muted-foreground bg-muted/40 rounded-md px-2.5 py-1.5">
                <span className="font-medium text-foreground">ใช้ที่ไหน: </span>{usage}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live preview — องค์ประกอบตัวอย่าง */}
      <div className="rounded-xl border bg-gradient-to-br from-background to-muted/30 p-5 space-y-4">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" /> ตัวอย่างการแสดงผล
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">ปุ่มหลัก</Button>
          <Button size="sm" variant="secondary">ปุ่มรอง</Button>
          <Button size="sm" variant="outline">ปุ่ม Outline</Button>
          <Button size="sm" variant="destructive">ปุ่มลบ</Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground">Primary</span>
          <span className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">Secondary</span>
          <span className="px-2.5 py-1 rounded-full bg-accent text-accent-foreground">Accent</span>
          <span className="px-2.5 py-1 rounded-full bg-success text-success-foreground">Success</span>
          <span className="px-2.5 py-1 rounded-full bg-warning text-warning-foreground">Warning</span>
          <span className="px-2.5 py-1 rounded-full bg-info text-info-foreground">Info</span>
          <span className="px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground">Destructive</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">ตัวอย่างการ์ด</div>
            <div className="font-semibold text-foreground">รายงานประจำวัน</div>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-3/4 bg-primary" />
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">มาเรียน 75%</div>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-success" /> อนุมัติ 24 รายการ</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-warning" /> รอดำเนินการ 5 รายการ</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-destructive" /> ปฏิเสธ 1 รายการ</div>
          </div>
        </div>
      </div>

      <SaveBar onSave={saveAll} />
    </div>
  );
};

// ---- Section: พื้นหลัง ----
const BackgroundSection = () => {
  const { settings, uploadImage } = useCmsSettings();
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <ImagePlus className="w-5 h-5 text-primary" /> พื้นหลังเว็บไซต์
      </h3>
      <div className="flex items-center gap-6">
        <div className="w-40 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
          {settings.hero_background?.value ? <img src={settings.hero_background.value} alt="BG" className="w-full h-full object-cover" /> : <span className="text-xs text-muted-foreground">ไม่มีภาพพื้นหลัง</span>}
        </div>
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return; await uploadImage(f, 'bg', 'hero_background');
          }} />
          <Button size="sm" variant="outline" asChild><span><Upload className="w-4 h-4 mr-1" /> อัปโหลดภาพพื้นหลัง</span></Button>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">แนะนำ: ขนาด 1920x600 พิกเซล</p>
      <div className="rounded-xl border border-dashed p-4 bg-muted/30 flex items-start gap-3">
        <MapPin className="w-5 h-5 text-primary mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-sm">พิกัด/รัศมีโรงเรียนถูกย้ายไปที่ "ผู้ดูแลระบบ → ตำแหน่งโรงเรียน"</p>
          <p className="text-xs text-muted-foreground mt-1">ตั้งค่าจุดเดียวใช้ร่วมกันทั้งระบบ (ลงเวลา, สแกนหน้า, สภาพอากาศ)</p>
        </div>
        <Button asChild size="sm" variant="outline"><a href="/dashboard/admin/school-location">เปิดหน้าตั้งค่า</a></Button>
      </div>
    </div>
  );
};

// ---- Section: AI Chatbot ----
const AiChatbotSection = () => {
  const { settings, updateSetting, saveAll, uploadImage } = useCmsSettings();
  const colorFields = [
    { key: "ai_bot_user_color", label: "สีกล่องข้อความผู้ใช้", def: "#2563eb" },
    { key: "ai_bot_assistant_color", label: "สีกล่องข้อความบอท", def: "#f1f5f9" },
    { key: "ai_bot_bg_color", label: "สีพื้นหลังกล่องแชท", def: "#ffffff" },
  ];
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Bot className="w-5 h-5 text-primary" /> AI Chatbot (ผู้ช่วย AI)
      </h3>

      <div className="grid gap-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <Label className="text-right text-sm">ชื่อบอท</Label>
          <Input
            className="col-span-2"
            value={settings.ai_bot_name?.value || ""}
            onChange={(e) => updateSetting("ai_bot_name", e.target.value)}
            placeholder="น้องโรงเรียน"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
          <Label className="text-right text-sm pt-2">ข้อความทักทาย</Label>
          <textarea
            className="col-span-2 min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={settings.ai_bot_greeting?.value || ""}
            onChange={(e) => updateSetting("ai_bot_greeting", e.target.value)}
            placeholder="สวัสดีค่ะ 👋 ..."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
          <Label className="text-right text-sm pt-2">บทบาท / Persona ของบอท</Label>
          <textarea
            className="col-span-2 min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            value={settings.ai_bot_persona?.value || ""}
            onChange={(e) => updateSetting("ai_bot_persona", e.target.value)}
            placeholder={`เช่น: คุณคือผู้ช่วย AI ของโรงเรียน...\nหน้าที่: ช่วยครู นักเรียน ผอ. ตอบเรื่องบทเรียน / ระบบ / ข่าวสาร\nห้าม: เปิดเผยข้อมูลส่วนตัว, ข้อมูลภายในฝ่ายบริหาร`}
          />
          <div className="col-start-2 col-span-2 -mt-2 text-xs text-muted-foreground">
            กำหนดบุคลิก ขอบเขต และข้อห้ามของบอท (ถ้าเว้นว่างจะใช้ค่าเริ่มต้น)
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <Label className="text-right text-sm">ภาษาที่รองรับ</Label>
          <Input
            className="col-span-2"
            value={settings.ai_bot_languages?.value || ""}
            onChange={(e) => updateSetting("ai_bot_languages", e.target.value)}
            placeholder="th,en,zh,ja,my,km,lo"
          />
          <div className="col-start-2 col-span-2 -mt-2 text-xs text-muted-foreground">
            คั่นด้วยจุลภาค บอทจะตรวจจับภาษาที่ผู้ใช้พิมพ์และตอบกลับภาษาเดียวกัน
          </div>
        </div>
      </div>

      <div>
        <Label className="text-sm mb-2 block">รูปไอคอน / Avatar ของบอท</Label>
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
            {settings.ai_bot_avatar_url?.value ? (
              <img src={settings.ai_bot_avatar_url.value} alt="Bot avatar" className="w-full h-full object-cover" />
            ) : (
              <Bot className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return; await uploadImage(f, 'bot_avatar', 'ai_bot_avatar_url', 'อัปโหลด Avatar สำเร็จ');
            }} />
            <Button size="sm" variant="outline" asChild><span><Upload className="w-4 h-4 mr-1" /> อัปโหลด Avatar</span></Button>
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-2">แนะนำ: ภาพสี่เหลี่ยมจัตุรัส 256x256 พิกเซลขึ้นไป</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Palette className="w-4 h-4 text-primary" /> สีกล่องสนทนา
        </h4>
        {colorFields.map(({ key, label, def }) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <Label className="text-right text-sm">{label}</Label>
            <div className="col-span-2 flex items-center gap-3">
              <input
                type="color"
                value={settings[key]?.value || def}
                onChange={(e) => updateSetting(key, e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <Input
                value={settings[key]?.value || def}
                onChange={(e) => updateSetting(key, e.target.value)}
                className="flex-1"
                placeholder={def}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <Label className="text-sm mb-2 block">ภาพพื้นหลังแชท (ไม่บังคับ)</Label>
        <div className="flex items-center gap-6">
          <div className="w-40 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
            {settings.ai_bot_bg_image_url?.value ? (
              <img src={settings.ai_bot_bg_image_url.value} alt="Chat BG" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">ไม่มีภาพ</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return; await uploadImage(f, 'bot_bg', 'ai_bot_bg_image_url');
              }} />
              <Button size="sm" variant="outline" asChild><span><Upload className="w-4 h-4 mr-1" /> อัปโหลดภาพพื้นหลัง</span></Button>
            </label>
            {settings.ai_bot_bg_image_url?.value && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateSetting("ai_bot_bg_image_url", "")}>
                <Trash2 className="w-3 h-3 mr-1" /> ลบภาพ
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">หากตั้งภาพพื้นหลัง จะแสดงทับสีพื้นหลังที่เลือก</p>
      </div>

      

      <SaveBar onSave={saveAll} />

    </div>
  );
};


// ---- Section: มาสคอท (Mascot) ----
const MascotSection = () => {
  const { settings, updateSetting, saveAll, uploadImage } = useCmsSettings();
  const slots: Array<{ key: string; label: string; desc: string }> = [
    { key: "mascot_happy_url", label: "อารมณ์ดี (Happy)", desc: "ใช้เมื่อสถานะรวมดีเยี่ยม" },
    { key: "mascot_neutral_url", label: "ปกติ (Neutral)", desc: "ใช้เมื่อสถานะพอใช้" },
    { key: "mascot_worried_url", label: "กังวล (Worried)", desc: "ใช้เมื่อมีเรื่องต้องดูแลด่วน" },
  ];
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" /> มาสคอทประจำโรงเรียน
      </h3>
      <p className="text-sm text-muted-foreground -mt-3">
        ตั้งชื่อและอัปโหลดรูปมาสคอท 3 อารมณ์ รองรับไฟล์ <b>.gif</b> เพื่อทำเป็นภาพเคลื่อนไหวได้
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center max-w-xl">
        <Label className="text-right text-sm">ชื่อมาสคอท</Label>
        <Input
          className="col-span-2"
          value={settings.mascot_name?.value || ""}
          onChange={(e) => updateSetting("mascot_name", e.target.value)}
          placeholder="น้องโรงเรียน"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {slots.map(({ key, label, desc }) => (
          <div key={key} className="rounded-xl border border-border p-4 bg-card space-y-3">
            <div>
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
            <div className="w-full aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
              {settings[key]?.value ? (
                <img src={settings[key].value} alt={label} className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">ยังไม่มีภาพ (ใช้ค่าเริ่มต้น)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    await uploadImage(f, 'mascot', key, 'อัปโหลดมาสคอทสำเร็จ');
                  }}
                />
                <Button size="sm" variant="outline" asChild className="w-full">
                  <span><Upload className="w-4 h-4 mr-1" /> อัปโหลด</span>
                </Button>
              </label>
              {settings[key]?.value && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateSetting(key, "")}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">แนะนำ: ภาพสี่เหลี่ยมจัตุรัส 512x512 พิกเซลขึ้นไป รูปแบบ PNG / WEBP / GIF (เคลื่อนไหว)</p>

      {/* Background image */}
      <div className="rounded-xl border border-border p-4 bg-card space-y-3 mt-4">
        <div>
          <div className="text-sm font-semibold">พื้นหลังมาสคอท (Background)</div>
          <div className="text-xs text-muted-foreground">รูปฉากหลังของมาสคอทบนหน้า Dashboard เช่น ภาพโรงเรียนแบบการ์ตูน (แนะนำ 1920x1024)</div>
        </div>
        <div className="w-full aspect-[16/9] max-w-2xl rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
          {settings.mascot_bg_url?.value ? (
            <img src={settings.mascot_bg_url.value} alt="Mascot background" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">ยังไม่มีภาพ (ใช้ค่าเริ่มต้น: ภาพโรงเรียนการ์ตูน)</span>
          )}
        </div>
        <div className="flex items-center gap-2 max-w-2xl">
          <label className="cursor-pointer flex-1">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                await uploadImage(f, 'mascot', 'mascot_bg_url', 'อัปโหลดพื้นหลังสำเร็จ');
              }}
            />
            <Button size="sm" variant="outline" asChild className="w-full">
              <span><Upload className="w-4 h-4 mr-1" /> อัปโหลดพื้นหลัง</span>
            </Button>
          </label>
          {settings.mascot_bg_url?.value && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateSetting("mascot_bg_url", "")}>
              <Trash2 className="w-4 h-4" /> ใช้ค่าเริ่มต้น
            </Button>
          )}
        </div>
      </div>

      <SaveBar onSave={saveAll} />
    </div>
  );
};


// ---- Images Tab ----
const ImagesTab = () => {

  const [images, setImages] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchImages = async () => {
    const { data } = await supabase.storage.from("cms-images").list("", { limit: 100 });
    if (data) setImages(data.filter(f => f.name !== ".emptyFolderPlaceholder"));
  };
  useEffect(() => { fetchImages(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const compressed = await compressImage(file, { maxWidth: 1600, maxSizeKB: 200 });
    const result = await uploadPublicFileWithFallback("cms-images", `${Date.now()}_${file.name}`, compressed);
    if (result.usedFallback) {
      await navigator.clipboard.writeText(result.publicUrl);
      toast.success("เพิ่มรูปสำเร็จ (โหมดสำรอง) และคัดลอก URL แล้ว");
    } else {
      toast.success("อัปโหลดสำเร็จ");
      fetchImages();
    }
    setUploading(false);
  };

  const getUrl = (name: string) => supabase.storage.from("cms-images").getPublicUrl(name).data.publicUrl;
  const handleDelete = async (name: string) => { await supabase.storage.from("cms-images").remove([name]); toast.success("ลบสำเร็จ"); fetchImages(); };
  const copyUrl = (name: string) => { navigator.clipboard.writeText(getUrl(name)); toast.success("คัดลอก URL แล้ว"); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">คลังรูปภาพ</h3>
        <label>
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <Button size="sm" asChild disabled={uploading}>
            <span><Upload className="w-4 h-4 mr-1" /> {uploading ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}</span>
          </Button>
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map(img => (
          <div key={img.name} className="border border-border rounded-lg overflow-hidden bg-card group relative">
            <img src={getUrl(img.name)} alt={img.name} className="w-full h-32 object-cover" />
            <div className="p-2">
              <p className="text-xs text-muted-foreground truncate">{img.name}</p>
              <div className="flex gap-1 mt-1">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyUrl(img.name)}>Copy URL</Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => handleDelete(img.name)}>ลบ</Button>
              </div>
            </div>
          </div>
        ))}
        {images.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">ยังไม่มีรูปภาพ</p>}
      </div>
    </div>
  );
};

// ---- Sidebar nav config ----
type NavItem = { key: string; label: string; desc?: string; icon: any; render: () => JSX.Element };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "หน้าหลัก",
    items: [
      { key: "homepage", label: "หน้าแรก", desc: "ตัวสร้างหน้าแรก", icon: Home, render: () => <HomepageEditor /> },
    ],
  },
  {
    label: "เนื้อหา",
    items: [
      { key: "pages", label: "หน้าเว็บย่อย", desc: "About / Contact ฯลฯ", icon: FileText, render: () => <PagesTab /> },
      { key: "menu", label: "เมนูเว็บไซต์", desc: "ลิงก์เมนูบนสุด", icon: MenuIcon, render: () => <MenuTab /> },
      { key: "images", label: "คลังรูปภาพ", desc: "อัปโหลด/คัดลอก URL", icon: ImageIcon, render: () => <ImagesTab /> },
    ],
  },
  {
    label: "เอกลักษณ์โรงเรียน",
    items: [
      { key: "identity", label: "ข้อมูลโรงเรียน", desc: "ชื่อ ที่อยู่ ผอ.", icon: Building2, render: () => <IdentitySection /> },
      { key: "branding", label: "โลโก้ & ตรา", desc: "โลโก้ ตราโรงเรียน ครุฑ", icon: Sparkles, render: () => <BrandingSection /> },
      { key: "app", label: "ระบบ & ไอคอน", desc: "ชื่อระบบ Favicon", icon: Smartphone, render: () => <AppIconSection /> },
    ],
  },
  {
    label: "รูปลักษณ์",
    items: [
      { key: "theme", label: "ธีมสี", desc: "Primary / Secondary / Accent", icon: Palette, render: () => <ThemeColorSection /> },
      { key: "background", label: "พื้นหลังเว็บ", desc: "Hero Background", icon: LayoutPanelTop, render: () => <BackgroundSection /> },
      { key: "mascot", label: "มาสคอท", desc: "รูป 3 อารมณ์ รองรับ GIF", icon: Sparkles, render: () => <MascotSection /> },
      { key: "ai_chatbot", label: "AI Chatbot", desc: "ชื่อ ไอคอน สีกล่อง พื้นหลังแชท", icon: Bot, render: () => <AiChatbotSection /> },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { key: "backup", label: "สำรอง / กู้คืน", desc: "Export/Import เนื้อหา CMS", icon: Package, render: () => <ConfigBackupCard scope="cms" /> },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items);

// ---- Main CMS Page ----
const CmsPage = () => {
  const [active, setActive] = useState<string>(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    return ALL_ITEMS.some(i => i.key === hash) ? hash : "homepage";
  });

  useEffect(() => {
    if (typeof window !== "undefined") window.location.hash = active;
  }, [active]);

  const current = ALL_ITEMS.find(i => i.key === active) ?? ALL_ITEMS[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            จัดการเว็บไซต์ (CMS)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">จัดระเบียบเนื้อหา รูปลักษณ์ และเอกลักษณ์โรงเรียนในที่เดียว</p>
        </div>
        <a href="/" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm"><Eye className="w-4 h-4 mr-1" /> ดูเว็บไซต์</Button>
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4">
        {/* Sidebar nav */}
        <Card className="shadow-card border-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <CardContent className="p-3 space-y-4">
            {NAV_GROUPS.map(group => (
              <div key={group.label}>
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                <div className="space-y-1 mt-1">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive = active === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActive(item.key)}
                        className={cn(
                          "w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                          isActive ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-foreground"
                        )}
                      >
                        <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", isActive ? "" : "text-primary")} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">{item.label}</p>
                          {item.desc && (
                            <p className={cn("text-[11px] mt-0.5 leading-tight", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                              {item.desc}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Content */}
        <Card className="shadow-card border-0 min-w-0">
          <CardContent className="pt-6">
            {current.render()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CmsPage;
