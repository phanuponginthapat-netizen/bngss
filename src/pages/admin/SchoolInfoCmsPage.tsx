import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import swal from "@/lib/swal";
import { Plus, Trash2, Save } from "lucide-react";
import RichTextEditor from "@/components/cms/RichTextEditor";

const SECTIONS = [
  { key: "history", label: "ประวัติสถานศึกษา", type: "richtext" },
  { key: "vision", label: "วิสัยทัศน์", type: "richtext" },
  { key: "mission", label: "พันธกิจ", type: "list" },
  { key: "goals", label: "เป้าประสงค์", type: "list" },
  { key: "identity", label: "อัตลักษณ์/เอกลักษณ์", type: "identity" },
  { key: "philosophy", label: "ปรัชญา/คำขวัญ", type: "philosophy" },
  { key: "contact", label: "ติดต่อโรงเรียน", type: "contact" },
];

export default function SchoolInfoCmsPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-bold">ข้อมูลโรงเรียน (CMS)</h1>
      <Tabs defaultValue="sections">
        <TabsList className="mb-4">
          <TabsTrigger value="sections">เนื้อหาหน้าเว็บ</TabsTrigger>
          <TabsTrigger value="faqs">FAQ</TabsTrigger>
          <TabsTrigger value="downloads">ดาวน์โหลด</TabsTrigger>
          <TabsTrigger value="nav">เมนูนำทาง</TabsTrigger>
        </TabsList>

        <TabsContent value="sections">
          <div className="space-y-4">
            {SECTIONS.map((s) => <SectionEditor key={s.key} sectionKey={s.key} label={s.label} type={s.type} />)}
          </div>
        </TabsContent>

        <TabsContent value="faqs"><FaqEditor /></TabsContent>
        <TabsContent value="downloads"><DownloadsEditor /></TabsContent>
        <TabsContent value="nav"><NavMenuEditor /></TabsContent>
      </Tabs>
    </div>
  );
}

function SectionEditor({ sectionKey, label, type }: { sectionKey: string; label: string; type: string }) {
  const [row, setRow] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (supabase as any).from("cms_school_info").select("*").eq("section_key", sectionKey).maybeSingle().then(({ data }: any) => setRow(data));
  }, [sectionKey]);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("cms_school_info").upsert({ ...row, section_key: sectionKey }, { onConflict: "section_key" });
    setSaving(false);
    if (error) swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: error.message });
    else swal.fire({ icon: "success", title: "บันทึกแล้ว", timer: 1200, showConfirmButton: false });
  };

  if (!row) return <Card><CardContent className="p-6">กำลังโหลด...</CardContent></Card>;
  const content = row.content || {};
  const setContent = (patch: any) => setRow({ ...row, content: { ...content, ...patch } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div><Label>หัวข้อ</Label><Input value={row.title || ""} onChange={(e) => setRow({ ...row, title: e.target.value })} /></div>
        <div><Label>คำโปรย</Label><Input value={row.subtitle || ""} onChange={(e) => setRow({ ...row, subtitle: e.target.value })} /></div>
        <div><Label>รูปหน้าปก (URL)</Label><Input value={row.cover_image || ""} onChange={(e) => setRow({ ...row, cover_image: e.target.value })} /></div>

        {type === "richtext" && (
          <div><Label>เนื้อหา</Label><RichTextEditor content={content.body || ""} onChange={(v) => setContent({ body: v })} /></div>
        )}
        {type === "list" && (
          <div>
            <Label>รายการ (บรรทัดละ 1 ข้อ)</Label>
            <Textarea rows={6} value={(content.items || []).join("\n")} onChange={(e) => setContent({ items: e.target.value.split("\n").filter(Boolean) })} />
          </div>
        )}
        {type === "identity" && (
          <>
            <div><Label>อัตลักษณ์</Label><Input value={content.identity || ""} onChange={(e) => setContent({ identity: e.target.value })} /></div>
            <div><Label>เอกลักษณ์</Label><Input value={content.uniqueness || ""} onChange={(e) => setContent({ uniqueness: e.target.value })} /></div>
          </>
        )}
        {type === "philosophy" && (
          <>
            <div><Label>ปรัชญา</Label><Input value={content.philosophy || ""} onChange={(e) => setContent({ philosophy: e.target.value })} /></div>
            <div><Label>คำขวัญ</Label><Input value={content.motto || ""} onChange={(e) => setContent({ motto: e.target.value })} /></div>
            <div><Label>สีประจำโรงเรียน</Label><Input value={content.colors || ""} onChange={(e) => setContent({ colors: e.target.value })} /></div>
            <div><Label>ต้นไม้ประจำโรงเรียน</Label><Input value={content.tree || ""} onChange={(e) => setContent({ tree: e.target.value })} /></div>
          </>
        )}
        {type === "contact" && (
          <>
            <div><Label>ที่อยู่</Label><Textarea rows={2} value={content.address || ""} onChange={(e) => setContent({ address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>โทรศัพท์</Label><Input value={content.phone || ""} onChange={(e) => setContent({ phone: e.target.value })} /></div>
              <div><Label>โทรสาร</Label><Input value={content.fax || ""} onChange={(e) => setContent({ fax: e.target.value })} /></div>
              <div><Label>อีเมล</Label><Input value={content.email || ""} onChange={(e) => setContent({ email: e.target.value })} /></div>
              <div><Label>เวลาทำการ</Label><Input value={content.hours || ""} onChange={(e) => setContent({ hours: e.target.value })} /></div>
            </div>
            <div><Label>Google Maps embed (iframe HTML)</Label><Textarea rows={3} value={content.map_embed || ""} onChange={(e) => setContent({ map_embed: e.target.value })} /></div>
          </>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2"><Switch checked={row.is_published} onCheckedChange={(v) => setRow({ ...row, is_published: v })} /><Label>เผยแพร่</Label></div>
          <Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />บันทึก</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FaqEditor() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => (supabase as any).from("cms_faqs").select("*").order("sort_order").then(({ data }: any) => setRows(data || []));
  useEffect(() => { load(); }, []);

  const add = async () => {
    await (supabase as any).from("cms_faqs").insert({ question: "คำถามใหม่", answer: "คำตอบ", category: "general", sort_order: rows.length });
    load();
  };
  const del = async (id: string) => { await (supabase as any).from("cms_faqs").delete().eq("id", id); load(); };
  const upd = async (r: any) => { await (supabase as any).from("cms_faqs").update({ question: r.question, answer: r.answer, category: r.category, is_published: r.is_published }).eq("id", r.id); load(); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>คำถามที่พบบ่อย</CardTitle>
        <Button onClick={add}><Plus className="mr-1 h-4 w-4" />เพิ่ม</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id} className="rounded-xl border p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Input value={r.category} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} placeholder="หมวด" />
              <Input className="col-span-2" value={r.question} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} placeholder="คำถาม" />
            </div>
            <Textarea rows={2} value={r.answer} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))} placeholder="คำตอบ" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Switch checked={r.is_published} onCheckedChange={(v) => setRows(rows.map((x, j) => j === i ? { ...x, is_published: v } : x))} /><Label className="text-xs">เผยแพร่</Label></div>
              <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => upd(r)}>บันทึก</Button><Button size="sm" variant="destructive" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DownloadsEditor() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => (supabase as any).from("cms_downloads").select("*").order("sort_order").then(({ data }: any) => setRows(data || []));
  useEffect(() => { load(); }, []);

  const add = async () => {
    await (supabase as any).from("cms_downloads").insert({ title: "เอกสารใหม่", file_url: "", category: "general", sort_order: rows.length });
    load();
  };
  const del = async (id: string) => { await (supabase as any).from("cms_downloads").delete().eq("id", id); load(); };
  const upd = async (r: any) => { await (supabase as any).from("cms_downloads").update({ title: r.title, description: r.description, file_url: r.file_url, category: r.category, is_published: r.is_published }).eq("id", r.id); load(); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>เอกสารดาวน์โหลด</CardTitle>
        <Button onClick={add}><Plus className="mr-1 h-4 w-4" />เพิ่ม</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id} className="rounded-xl border p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Input value={r.category || ""} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} placeholder="หมวด" />
              <Input className="col-span-2" value={r.title || ""} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="ชื่อเอกสาร" />
            </div>
            <Input value={r.description || ""} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="คำอธิบาย" />
            <Input value={r.file_url || ""} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, file_url: e.target.value } : x))} placeholder="URL ไฟล์ (Google Drive/ลิงก์ไฟล์)" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Switch checked={r.is_published} onCheckedChange={(v) => setRows(rows.map((x, j) => j === i ? { ...x, is_published: v } : x))} /><Label className="text-xs">เผยแพร่</Label></div>
              <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => upd(r)}>บันทึก</Button><Button size="sm" variant="destructive" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NavMenuEditor() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => (supabase as any).from("cms_nav_menu").select("*").order("sort_order").then(({ data }: any) => setRows(data || []));
  useEffect(() => { load(); }, []);

  const add = async (parent_id: string | null = null) => {
    await (supabase as any).from("cms_nav_menu").insert({ label: "เมนูใหม่", parent_id, sort_order: rows.length });
    load();
  };
  const del = async (id: string) => { await (supabase as any).from("cms_nav_menu").delete().eq("id", id); load(); };
  const upd = async (r: any) => {
    await (supabase as any).from("cms_nav_menu").update({ label: r.label, url: r.url, icon: r.icon, description: r.description, sort_order: r.sort_order, is_published: r.is_published, open_in_new_tab: r.open_in_new_tab }).eq("id", r.id);
    load();
  };

  const roots = rows.filter((r) => !r.parent_id);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>เมนูนำทางหลัก (Mega Menu)</CardTitle>
        <Button onClick={() => add(null)}><Plus className="mr-1 h-4 w-4" />เพิ่มเมนูหลัก</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {roots.map((root) => (
          <div key={root.id} className="rounded-xl border p-3">
            <NavRow row={root} onChange={(v) => setRows(rows.map((x) => x.id === root.id ? { ...x, ...v } : x))} onSave={() => upd(rows.find((x) => x.id === root.id))} onDelete={() => del(root.id)} />
            <div className="mt-2 ml-6 space-y-2 border-l pl-4">
              {rows.filter((c) => c.parent_id === root.id).map((child) => (
                <NavRow key={child.id} row={child} onChange={(v) => setRows(rows.map((x) => x.id === child.id ? { ...x, ...v } : x))} onSave={() => upd(rows.find((x) => x.id === child.id))} onDelete={() => del(child.id)} />
              ))}
              <Button size="sm" variant="outline" onClick={() => add(root.id)}><Plus className="mr-1 h-3 w-3" />เพิ่มเมนูย่อย</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NavRow({ row, onChange, onSave, onDelete }: any) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <Input value={row.label || ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="ชื่อเมนู" />
        <Input value={row.url || ""} onChange={(e) => onChange({ url: e.target.value })} placeholder="URL เช่น /about/history" />
        <Input value={row.icon || ""} onChange={(e) => onChange({ icon: e.target.value })} placeholder="ไอคอน (Lucide เช่น Home)" />
        <Input type="number" value={row.sort_order ?? 0} onChange={(e) => onChange({ sort_order: Number(e.target.value) })} placeholder="ลำดับ" />
      </div>
      <Input value={row.description || ""} onChange={(e) => onChange({ description: e.target.value })} placeholder="คำอธิบายสั้น (แสดงใน mega menu)" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1"><Switch checked={row.is_published} onCheckedChange={(v) => onChange({ is_published: v })} /><Label className="text-xs">เผยแพร่</Label></div>
          <div className="flex items-center gap-1"><Switch checked={row.open_in_new_tab} onCheckedChange={(v) => onChange({ open_in_new_tab: v })} /><Label className="text-xs">แท็บใหม่</Label></div>
        </div>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={onSave}>บันทึก</Button><Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button></div>
      </div>
    </div>
  );
}
