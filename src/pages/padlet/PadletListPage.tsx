import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, StickyNote, Copy, Trash2, Link2, LayoutGrid, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { useMyTeacherAssignments } from "@/hooks/useMyTeacherAssignments";
import { shortenUrl } from "@/lib/shortlink";
import { saveErrorMessage } from "@/lib/saveError";
import { swal } from "@/lib/swal";

const BG_OPTIONS = [
  { key: "paper", label: "กระดาษโน้ต", className: "bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.08)_1px,transparent_0)] [background-size:16px_16px] bg-amber-50" },
  { key: "grid", label: "กริด", className: "bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] [background-size:24px_24px] bg-slate-50" },
  { key: "sky", label: "ท้องฟ้า", className: "bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100" },
  { key: "sunset", label: "พระอาทิตย์", className: "bg-gradient-to-br from-orange-100 via-pink-100 to-rose-200" },
  { key: "forest", label: "ป่าไม้", className: "bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100" },
];

export default function PadletListPage() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const { role, isTeacher, isAdmin, isDirector } = useUserRole();
  const canCreate = isTeacher || isAdmin || isDirector;

  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [background, setBackground] = useState("paper");
  const [allowGuestPost, setAllowGuestPost] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<string>("school"); // "school" or assignment id
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverSignedMap, setCoverSignedMap] = useState<Record<string, string>>({});
  const { data: myAssignments = [] } = useMyTeacherAssignments();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("padlet_boards")
      .select("*, subjects:subject_id(name_th, code), classrooms:classroom_id(name, grade_level)")
      .order("updated_at", { ascending: false });
    if (error) toast.error(saveErrorMessage(error));
    setBoards(data || []);
    setLoading(false);
    const covers = (data || []).map((b: any) => b.cover_image_url).filter(Boolean);
    if (covers.length) {
      const { data: signed } = await supabase.storage.from("padlet").createSignedUrls(covers, 3600);
      const map: Record<string, string> = {};
      (signed || []).forEach((s: any, i: number) => { if (s.signedUrl) map[covers[i]] = s.signedUrl; });
      setCoverSignedMap(map);
    }
  };


  useEffect(() => {
    load();
    const ch = supabase
      .channel("padlet_boards_list")
      .on("postgres_changes", { event: "*", schema: "public", table: "padlet_boards" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const create = async () => {
    if (!title.trim()) { toast.error("กรุณาตั้งชื่อกระดาน"); return; }
    if (!user) return;
    setSaving(true);
    const picked = scope !== "school" ? myAssignments.find(a => a.id === scope) : null;
    const boardId = crypto.randomUUID();
    const { error } = await supabase.from("padlet_boards").insert({
      id: boardId,
      owner_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      background,
      allow_guest_post: allowGuestPost,
      subject_id: picked?.subject_id || null,
      classroom_id: picked?.classroom_id || null,
      cover_image_url: coverUrl || null,
    });
    setSaving(false);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("สร้างกระดานแล้ว");
    setOpen(false);
    setTitle(""); setDescription(""); setBackground("paper"); setAllowGuestPost(true); setScope("school"); setCoverUrl("");
    navigate(`/dashboard/padlet/${boardId}`);
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const del = async (id: string) => {
    const ok = await swal.confirm({ title: "ยืนยันการลบ?", text: "ลบกระดานนี้? โน้ตทั้งหมดจะหายไปด้วย", danger: true });
    if (!ok) return;
    if (deletingId) return;
    setDeletingId(id);
    const { error } = await supabase.from("padlet_boards").delete().eq("id", id);
    setDeletingId(null);
    if (error) toast.error(saveErrorMessage(error)); else toast.success("ลบแล้ว");
  };

  const copyLink = async (b: any) => {
    const url = `${location.origin}/dashboard/padlet/${b.id}`;
    const t = toast.loading("กำลังสร้างลิงก์สั้น...");
    const short = await shortenUrl(url);
    await navigator.clipboard.writeText(short);
    toast.dismiss(t);
    toast.success(short === url ? "คัดลอกลิงก์แล้ว" : `คัดลอกลิงก์สั้นแล้ว: ${short}`);
  };

  const uploadCover = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("รูปปกต้องไม่เกิน 5MB"); return; }
    setUploadingCover(true);
    const ext = (file.name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] || "jpg").toLowerCase();
    const path = `covers/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error } = await supabase.storage.from("padlet").upload(path, file, { upsert: false, contentType: file.type });
    setUploadingCover(false);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    setCoverUrl(path);
    toast.success("อัปโหลดรูปปกแล้ว");
  };


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-fuchsia-500" /> กระดานโน้ต (Padlet)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            สร้างบอร์ดแขวนใบงาน · ให้นักเรียนแปะโน้ต รูปภาพ ลิงก์ในคาบเรียนได้แบบเรียลไทม์
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> สร้างกระดานใหม่
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : boards.length === 0 ? (
        <Card><CardContent className="py-16 text-center space-y-3">
          <StickyNote className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">ยังไม่มีกระดาน</p>
          {canCreate && <Button onClick={() => setOpen(true)} variant="outline" className="gap-2"><Plus className="w-4 h-4" /> สร้างกระดานแรก</Button>}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((b) => {
            const bg = BG_OPTIONS.find(o => o.key === b.background) || BG_OPTIONS[0];
            const mine = b.owner_id === user?.id;
            return (
              <Card
                key={b.id}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group"
                onClick={() => navigate(`/dashboard/padlet/${b.id}`)}
              >
                <div className={`h-32 ${bg.className} relative overflow-hidden`}>
                  {b.cover_image_url && coverSignedMap[b.cover_image_url] && (
                    <img src={coverSignedMap[b.cover_image_url]} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Badge variant="secondary" className="text-[10px] shadow">{bg.label}</Badge>
                  </div>
                </div>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{b.title}</h3>
                      {b.description && <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>}
                      {(b.subjects || b.classrooms) ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {b.subjects && <Badge variant="outline" className="text-[10px] gap-1"><Users className="w-3 h-3" />{b.subjects.name_th}</Badge>}
                          {b.classrooms && <Badge variant="outline" className="text-[10px]">{b.classrooms.name}</Badge>}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] mt-1">ทั้งโรงเรียน</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{b.updated_at ? formatDistanceToNow(new Date(b.updated_at), { addSuffix: true, locale: th }) : ""}</span>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyLink(b)} title="คัดลอกลิงก์">
                        <Link2 className="w-3.5 h-3.5" />
                      </Button>
                      {(mine || isAdmin || isDirector) && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={deletingId === b.id} onClick={() => del(b.id)} title="ลบ">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>สร้างกระดานใหม่</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">ชื่อกระดาน *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น สิ่งที่หนูเรียนรู้วันนี้" />
            </div>
            <div>
              <label className="text-sm font-medium">คำอธิบาย</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="อธิบายวัตถุประสงค์ของกระดาน (ไม่บังคับ)" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ให้ใครเห็นกระดานนี้</label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">ทั้งโรงเรียน (ทุกคน)</SelectItem>
                  {myAssignments.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.subjectName} · {a.classroomName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                เลือกวิชา/ห้อง เพื่อให้เฉพาะนักเรียนในวิชานั้นเห็นและแปะโน้ตได้
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">พื้นหลัง</label>
              <div className="grid grid-cols-5 gap-2">
                {BG_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setBackground(o.key)}
                    className={`h-12 rounded border-2 ${o.className} ${background === o.key ? "border-primary ring-2 ring-primary/30" : "border-transparent"}`}
                    title={o.label}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ภาพปก (ไม่บังคับ · สูงสุด 5MB)</label>
              <input type="file" accept="image/*" disabled={uploadingCover}
                onChange={e => e.target.files?.[0] && uploadCover(e.target.files[0])}
                className="text-xs" />
              {uploadingCover && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> กำลังอัปโหลด…</div>}
              {coverUrl && !uploadingCover && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-emerald-600">✓ อัปโหลดแล้ว</span>
                  <button type="button" onClick={() => setCoverUrl("")} className="text-destructive underline">ลบ</button>
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allowGuestPost} onChange={e => setAllowGuestPost(e.target.checked)} />
              อนุญาตให้นักเรียนแปะโน้ตได้
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={create} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}สร้าง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
