import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { showError, showSuccess, showConfirm } from "@/lib/swal";
import { Image as ImageIcon, FileText, StickyNote, Download, Trash2, Search, Upload, Users, Building2, Lock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

type Item = {
  id: string;
  source: "line" | "manual";
  kind: "photo" | "file" | "note";
  title: string;
  description: string | null;
  note_text: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  original_filename: string | null;
  line_group_id: string | null;
  line_sender_name: string | null;
  department: string | null;
  visibility: "everyone" | "department" | "admin";
  tags: string[];
  created_at: string;
};

type Group = {
  id: string;
  line_group_id: string;
  group_name: string;
  department: string | null;
  default_visibility: "everyone" | "department" | "admin";
  auto_capture: boolean;
  notes: string | null;
};

const kindMeta: Record<Item["kind"], { icon: any; label: string; color: string }> = {
  photo: { icon: ImageIcon, label: "รูปภาพ", color: "bg-pink-500/10 text-pink-600 dark:text-pink-300" },
  file: { icon: FileText, label: "ไฟล์", color: "bg-blue-500/10 text-blue-600 dark:text-blue-300" },
  note: { icon: StickyNote, label: "โน้ต", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
};

const visMeta: Record<Item["visibility"], string> = {
  everyone: "ทุกคนในระบบ",
  department: "เฉพาะแผนก",
  admin: "แอดมินเท่านั้น",
};

function formatBytes(n: number | null) {
  if (!n) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function LineVaultPage() {
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "director";
  const [tab, setTab] = useState<"all" | "photo" | "file" | "note" | "manage">("all");
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("line_vault_items")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setItems((data as any) || []);
    if (isAdmin) {
      const { data: g } = await supabase.from("line_vault_groups").select("*").order("created_at", { ascending: false });
      setGroups((g as any) || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [isAdmin]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (tab !== "all" && tab !== "manage" && i.kind !== tab) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (i.title || "").toLowerCase().includes(s)
        || (i.note_text || "").toLowerCase().includes(s)
        || (i.original_filename || "").toLowerCase().includes(s)
        || (i.line_sender_name || "").toLowerCase().includes(s);
    });
  }, [items, tab, q]);

  async function handleOpen(item: Item) {
    if (item.kind === "note") {
      await showConfirm({
        title: item.title,
        html: `<div style="text-align:left;white-space:pre-wrap">${(item.note_text || "").replace(/</g, "&lt;")}</div>`,
        confirmButtonText: "ปิด",
        showCancelButton: false,
      });
      return;
    }
    const { data, error } = await supabase.functions.invoke("line-vault-download", {
      body: { item_id: item.id, expires_in: 600 },
    });
    if (error || !data?.url) {
      showError("ดาวน์โหลดไม่สำเร็จ", (data as any)?.error || error?.message);
      return;
    }
    const a = document.createElement("a");
    a.href = data.url;
    a.download = data.filename || item.title;
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleDelete(item: Item) {
    const ok = await showConfirm({ title: "ลบรายการนี้?", text: item.title, confirmButtonText: "ลบ" });
    if (!ok) return;
    if (item.storage_path) {
      await supabase.storage.from("line-vault").remove([item.storage_path]);
    }
    const { error } = await supabase.from("line_vault_items").delete().eq("id", item.id);
    if (error) return showError("ลบไม่สำเร็จ", error.message);
    showSuccess("ลบแล้ว");
    load();
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">คลังไฟล์ LINE Vault</h1>
          <p className="text-sm text-muted-foreground">เก็บรูปภาพ ไฟล์ และโน้ตจากกลุ่ม LINE OA อัตโนมัติ — ไม่หมดอายุ</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />รีเฟรช</Button>
          {isAdmin && <ManualUploadDialog onDone={load} />}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">ทั้งหมด <Badge variant="secondary" className="ml-2">{items.length}</Badge></TabsTrigger>
          <TabsTrigger value="photo"><ImageIcon className="h-4 w-4 mr-1" />รูปภาพ</TabsTrigger>
          <TabsTrigger value="file"><FileText className="h-4 w-4 mr-1" />ไฟล์</TabsTrigger>
          <TabsTrigger value="note"><StickyNote className="h-4 w-4 mr-1" />โน้ต</TabsTrigger>
          {isAdmin && <TabsTrigger value="manage"><Users className="h-4 w-4 mr-1" />จัดการกลุ่ม</TabsTrigger>}
        </TabsList>

        <div className="mt-4">
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ · ไฟล์ · ข้อความ · ผู้ส่ง" className="pl-9" />
          </div>

          <TabsContent value="all" className="m-0"><ItemGrid items={filtered} loading={loading} isAdmin={isAdmin} onOpen={handleOpen} onDelete={handleDelete} /></TabsContent>
          <TabsContent value="photo" className="m-0"><ItemGrid items={filtered} loading={loading} isAdmin={isAdmin} onOpen={handleOpen} onDelete={handleDelete} /></TabsContent>
          <TabsContent value="file" className="m-0"><ItemGrid items={filtered} loading={loading} isAdmin={isAdmin} onOpen={handleOpen} onDelete={handleDelete} /></TabsContent>
          <TabsContent value="note" className="m-0"><ItemGrid items={filtered} loading={loading} isAdmin={isAdmin} onOpen={handleOpen} onDelete={handleDelete} /></TabsContent>

          {isAdmin && (
            <TabsContent value="manage" className="m-0">
              <GroupsManager groups={groups} onChange={load} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}

function ItemGrid({ items, loading, isAdmin, onOpen, onDelete }: { items: Item[]; loading: boolean; isAdmin: boolean; onOpen: (i: Item) => void; onDelete: (i: Item) => void; }) {
  if (loading) return <div className="text-center py-10 text-muted-foreground">กำลังโหลด...</div>;
  if (!items.length) return <div className="text-center py-16 text-muted-foreground">ยังไม่มีรายการ</div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {items.map(item => {
        const M = kindMeta[item.kind];
        const Icon = M.icon;
        return (
          <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${M.color}`}>
                  <Icon className="h-3 w-3" />{M.label}
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {item.visibility === "everyone" ? <Users className="h-3 w-3 mr-0.5" /> : item.visibility === "department" ? <Building2 className="h-3 w-3 mr-0.5" /> : <Lock className="h-3 w-3 mr-0.5" />}
                  {visMeta[item.visibility]}
                </Badge>
              </div>
              <div className="font-medium line-clamp-2 min-h-[2.5rem]" title={item.title}>{item.title}</div>
              {item.kind === "note" && item.note_text && (
                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{item.note_text}</p>
              )}
              {item.kind !== "note" && (
                <div className="text-xs text-muted-foreground">
                  {item.original_filename} · {formatBytes(item.size_bytes)}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>{item.line_sender_name ? `จาก ${item.line_sender_name}` : item.source === "manual" ? "อัปโหลดเอง" : "จาก LINE"}</span>
                <span>{format(new Date(item.created_at), "d MMM", { locale: th })}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1" onClick={() => onOpen(item)}>
                  {item.kind === "note" ? <><StickyNote className="h-4 w-4 mr-1" />เปิด</> : <><Download className="h-4 w-4 mr-1" />ดาวน์โหลด</>}
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="ghost" onClick={() => onDelete(item)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function ManualUploadDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"file" | "photo" | "note">("file");
  const [title, setTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"everyone" | "department" | "admin">("everyone");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return toast.error("กรอกชื่อ");
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      let storage_path: string | null = null;
      let mime_type: string | null = null;
      let size_bytes: number | null = null;
      let original_filename: string | null = null;

      if (kind !== "note") {
        if (!file) throw new Error("เลือกไฟล์ก่อน");
        const ext = file.name.split(".").pop() || "bin";
        const now = new Date();
        storage_path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/manual/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("line-vault").upload(storage_path, file, { contentType: file.type });
        if (upErr) throw upErr;
        mime_type = file.type; size_bytes = file.size; original_filename = file.name;
      }

      const { error } = await supabase.from("line_vault_items").insert({
        source: "manual", kind, title, note_text: kind === "note" ? noteText : null,
        storage_path, mime_type, size_bytes, original_filename,
        visibility, uploaded_by: uid,
      });
      if (error) throw error;
      showSuccess("อัปโหลดสำเร็จ");
      setOpen(false); setTitle(""); setNoteText(""); setFile(null);
      onDone();
    } catch (e: any) { showError("อัปโหลดไม่สำเร็จ", e.message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Upload className="h-4 w-4 mr-1" />อัปโหลดเอง</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>เพิ่มเข้าคลัง</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>ประเภท</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="file">ไฟล์เอกสาร</SelectItem>
                <SelectItem value="photo">รูปภาพ</SelectItem>
                <SelectItem value="note">โน้ต/ข้อความ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>ชื่อ</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น หนังสือเวียน 001/2569" />
          </div>
          {kind === "note" ? (
            <div>
              <Label>ข้อความ</Label>
              <Textarea rows={5} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            </div>
          ) : (
            <div>
              <Label>ไฟล์</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept={kind === "photo" ? "image/*" : undefined} />
            </div>
          )}
          <div>
            <Label>ให้ใครเห็น</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">ทุกคนในระบบ</SelectItem>
                <SelectItem value="department">เฉพาะแผนก</SelectItem>
                <SelectItem value="admin">แอดมินเท่านั้น</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={submit} disabled={busy}>{busy ? "กำลังอัปโหลด..." : "บันทึก"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GroupsManager({ groups, onChange }: { groups: Group[]; onChange: () => void }) {
  async function update(id: string, patch: Partial<Group>) {
    const { error } = await supabase.from("line_vault_groups").update(patch).eq("id", id);
    if (error) return showError("บันทึกไม่สำเร็จ", error.message);
    onChange();
  }
  async function remove(id: string) {
    const ok = await showConfirm({ title: "ลบกลุ่มนี้?", text: "รายการที่จับไปแล้วยังคงอยู่", confirmButtonText: "ลบ" });
    if (!ok) return;
    await supabase.from("line_vault_groups").delete().eq("id", id);
    onChange();
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>กลุ่ม LINE ที่เชื่อมกับคลัง</CardTitle>
        <p className="text-sm text-muted-foreground">
          เชิญ LINE OA เข้ากลุ่มของคุณ กลุ่มใหม่จะปรากฏที่นี่โดยอัตโนมัติ (ปิดการจับไว้ก่อน) —
          ตั้งชื่อและเปิด "จับข้อความอัตโนมัติ" เพื่อเริ่มเก็บไฟล์/รูป/โน้ต
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!groups.length && <div className="text-sm text-muted-foreground py-6 text-center">ยังไม่มีกลุ่มที่ตรวจพบ</div>}
        {groups.map(g => (
          <div key={g.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Input className="max-w-sm" defaultValue={g.group_name} onBlur={(e) => e.target.value !== g.group_name && update(g.id, { group_name: e.target.value })} />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">จับอัตโนมัติ</span>
                <Switch checked={g.auto_capture} onCheckedChange={(v) => update(g.id, { auto_capture: v })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <span className="text-muted-foreground">มองเห็นโดย:</span>
              <Select value={g.default_visibility} onValueChange={(v) => update(g.id, { default_visibility: v as any })}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">ทุกคน</SelectItem>
                  <SelectItem value="department">เฉพาะแผนก</SelectItem>
                  <SelectItem value="admin">แอดมิน</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">Group ID: {g.line_group_id}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
