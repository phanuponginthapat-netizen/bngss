import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Plus, ArrowLeft, Trash2, Heart, Copy, Paperclip, Link2, StickyNote, X,
  FileText, Image as ImageIcon, Download,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import DOMPurify from "dompurify";
import PadletNoteEditor, { padletNoteEditorEmpty } from "./PadletNoteEditor";
import { shortenUrl } from "@/lib/shortlink";

const BG_MAP: Record<string, string> = {
  paper: "bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.08)_1px,transparent_0)] [background-size:16px_16px] bg-amber-50",
  grid: "bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] [background-size:24px_24px] bg-slate-50",
  sky: "bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100",
  sunset: "bg-gradient-to-br from-orange-100 via-pink-100 to-rose-200",
  forest: "bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100",
};

const COLORS = [
  { key: "yellow", cls: "bg-yellow-100 border-yellow-300" },
  { key: "pink", cls: "bg-pink-100 border-pink-300" },
  { key: "sky", cls: "bg-sky-100 border-sky-300" },
  { key: "lime", cls: "bg-lime-100 border-lime-300" },
  { key: "orange", cls: "bg-orange-100 border-orange-300" },
  { key: "violet", cls: "bg-violet-100 border-violet-300" },
  { key: "white", cls: "bg-white border-slate-300" },
];

const ROTATIONS = ["-rotate-1", "rotate-1", "rotate-0", "-rotate-2", "rotate-2"];

type Attachment = { path: string; name: string; type: string; size: number };

function isImage(t: string) { return t.startsWith("image/"); }
function isVideo(t: string) { return t.startsWith("video/"); }
function isAudio(t: string) { return t.startsWith("audio/"); }
function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function youTubeId(u: string): string | null {
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export default function PadletBoardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const { isAdmin, isDirector } = useUserRole();

  const [board, setBoard] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contentHtml, setContentHtml] = useState("");
  const [color, setColor] = useState("yellow");
  const [linkUrl, setLinkUrl] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [coverSigned, setCoverSigned] = useState<string>("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isOwner = board && user && board.owner_id === user.id;
  const canManageBoard = isOwner || isAdmin || isDirector;
  const canPost = board && (board.allow_guest_post || isOwner);

  const loadBoard = async () => {
    if (!id) return;
    const { data, error } = await supabase.from("padlet_boards").select("*, subjects:subject_id(name_th, code), classrooms:classroom_id(name, grade_level)").eq("id", id).maybeSingle();
    if (error) { toast.error(error.message); return; }
    setBoard(data);
  };

  const loadNotes = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("padlet_notes")
      .select("*")
      .eq("board_id", id)
      .order("created_at", { ascending: false });
    setNotes(data || []);
    const paths: string[] = [];
    (data || []).forEach((n: any) => {
      if (n.image_url) paths.push(n.image_url);
      (n.attachments || []).forEach((a: Attachment) => paths.push(a.path));
    });
    const unique = Array.from(new Set(paths));
    if (unique.length) {
      const { data: signed } = await supabase.storage.from("padlet").createSignedUrls(unique, 3600);
      const map: Record<string, string> = {};
      (signed || []).forEach((s: any, i: number) => { if (s.signedUrl) map[unique[i]] = s.signedUrl; });
      setSignedUrls(map);
    }
  };

  useEffect(() => {
    (async () => { setLoading(true); await loadBoard(); await loadNotes(); setLoading(false); })();
    const ch = supabase
      .channel(`padlet_board_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "padlet_notes", filter: `board_id=eq.${id}` }, loadNotes)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "padlet_boards", filter: `id=eq.${id}` }, loadBoard)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const resetForm = () => {
    setEditingId(null);
    setContentHtml(""); setLinkUrl(""); setColor("yellow"); setAttachments([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadFiles = async (files: FileList) => {
    if (!user || !id) return;
    setUploading(true);
    const added: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`ไฟล์ ${f.name} เกิน 20MB`);
        continue;
      }
      const ext = f.name.split(".").pop() || "bin";
      const path = `${id}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("padlet").upload(path, f, { upsert: false, contentType: f.type });
      if (error) { toast.error(error.message); continue; }
      added.push({ path, name: f.name, type: f.type || "application/octet-stream", size: f.size });
    }
    if (added.length) {
      // preload signed urls for previews in dialog
      const { data: signed } = await supabase.storage.from("padlet").createSignedUrls(added.map(a => a.path), 3600);
      setSignedUrls(prev => {
        const next = { ...prev };
        (signed || []).forEach((s: any, i: number) => { if (s.signedUrl) next[added[i].path] = s.signedUrl; });
        return next;
      });
    }
    setAttachments(prev => [...prev, ...added]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAttachment = async (a: Attachment) => {
    await supabase.storage.from("padlet").remove([a.path]);
    setAttachments(prev => prev.filter(x => x.path !== a.path));
  };

  const submitNote = async () => {
    if (!user || !id) return;
    const empty = padletNoteEditorEmpty(contentHtml);
    if (empty && !attachments.length && !linkUrl.trim()) {
      toast.error("กรอกข้อความ ลิงก์ หรือแนบไฟล์");
      return;
    }
    setSaving(true);
    const clean = DOMPurify.sanitize(contentHtml || "");
    let authorName = "ผู้ใช้";
    const { data: prof } = await supabase.from("profiles").select("first_name,last_name").eq("id", user.id).maybeSingle();
    if (prof) authorName = `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || authorName;

    if (editingId) {
      const { error } = await supabase.from("padlet_notes").update({
        content: clean || null, color, link_url: linkUrl.trim() || null, attachments: attachments as any,
      }).eq("id", editingId);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("บันทึกแล้ว");
    } else {
      const { error } = await supabase.from("padlet_notes").insert({
        board_id: id, author_id: user.id, author_name: authorName,
        content: clean || null, color, link_url: linkUrl.trim() || null,
        attachments: attachments as any,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("แปะโน้ตแล้ว");
    }
    setOpen(false);
    resetForm();
  };

  const startEdit = (n: any) => {
    setEditingId(n.id);
    setContentHtml(n.content || "");
    setColor(n.color || "yellow");
    setLinkUrl(n.link_url || "");
    setAttachments((n.attachments as Attachment[]) || []);
    setOpen(true);
  };

  const deleteNote = async (n: any) => {
    if (!confirm("ลบโน้ตนี้?")) return;
    const paths = [
      ...(n.image_url ? [n.image_url] : []),
      ...((n.attachments || []) as Attachment[]).map(a => a.path),
    ];
    if (paths.length) await supabase.storage.from("padlet").remove(paths);
    const { error } = await supabase.from("padlet_notes").delete().eq("id", n.id);
    if (error) toast.error(error.message);
  };

  const likeNote = async (n: any) => {
    await supabase.from("padlet_notes").update({ likes: (n.likes || 0) + 1 }).eq("id", n.id);
  };

  const copyLink = async () => {
    const t = toast.loading("กำลังสร้างลิงก์สั้น...");
    const short = await shortenUrl(location.href);
    await navigator.clipboard.writeText(short);
    toast.dismiss(t);
    toast.success(short === location.href ? "คัดลอกลิงก์แล้ว" : `คัดลอกลิงก์สั้นแล้ว: ${short}`);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!board) return <div className="text-center py-20 text-muted-foreground">ไม่พบกระดาน</div>;

  const bgClass = BG_MAP[board.background] || BG_MAP.paper;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/padlet")}><ArrowLeft className="w-4 h-4" /></Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{board.title}</h1>
            {board.description && <p className="text-sm text-muted-foreground">{board.description}</p>}
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px]">{notes.length} โน้ต</Badge>
              <Badge variant="outline" className="text-[10px]">{board.allow_guest_post ? "เปิดให้แปะ" : "อ่านอย่างเดียว"}</Badge>
              {board.subjects && <Badge variant="outline" className="text-[10px]">{board.subjects.name_th}</Badge>}
              {board.classrooms && <Badge variant="outline" className="text-[10px]">{board.classrooms.name}</Badge>}
              {!board.subject_id && !board.classroom_id && <Badge variant="outline" className="text-[10px]">ทั้งโรงเรียน</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-1"><Copy className="w-3.5 h-3.5" /> คัดลอกลิงก์</Button>
          {canManageBoard && (
            <Button variant="outline" size="sm"
              onClick={async () => {
                const { error } = await supabase.from("padlet_boards").update({ allow_guest_post: !board.allow_guest_post }).eq("id", board.id);
                if (error) toast.error(error.message);
              }}
            >{board.allow_guest_post ? "ปิดการแปะ" : "เปิดการแปะ"}</Button>
          )}
          {canPost && (
            <Button onClick={() => { resetForm(); setOpen(true); }} size="sm" className="gap-1"><Plus className="w-4 h-4" /> แปะโน้ต</Button>
          )}
        </div>
      </div>

      <div className={`min-h-[70vh] rounded-lg p-4 ${bgClass}`}>
        {notes.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <StickyNote className="w-12 h-12 mx-auto text-slate-400" />
            <p className="text-slate-500">ยังไม่มีโน้ต · {canPost ? "กด \"แปะโน้ต\" เพื่อเริ่ม" : "รอครูเปิดให้แปะ"}</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]">
            {notes.map((n, i) => {
              const c = COLORS.find(x => x.key === n.color) || COLORS[0];
              const rot = ROTATIONS[i % ROTATIONS.length];
              const canEdit = user && (n.author_id === user.id || canManageBoard);
              const atts: Attachment[] = n.attachments || [];
              const ytId = n.link_url ? youTubeId(n.link_url) : null;
              return (
                <div key={n.id}
                  className={`mb-4 break-inside-avoid border-2 rounded-md p-3 shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5 hover:rotate-0 ${c.cls} ${rot}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-xs font-medium text-slate-700 truncate">{n.author_name || "ไม่ระบุ"}</div>
                    {canEdit && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEdit(n)} className="text-[10px] text-slate-500 hover:text-primary underline">แก้ไข</button>
                        <button onClick={() => deleteNote(n)} className="text-slate-500 hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Images */}
                  {atts.filter(a => isImage(a.type)).map(a => (
                    <a key={a.path} href={signedUrls[a.path] || "#"} target="_blank" rel="noreferrer">
                      <img src={signedUrls[a.path]} alt={a.name} className="w-full rounded mb-2 border border-black/10" loading="lazy" />
                    </a>
                  ))}
                  {n.image_url && signedUrls[n.image_url] && (
                    <a href={signedUrls[n.image_url]} target="_blank" rel="noreferrer">
                      <img src={signedUrls[n.image_url]} alt="" className="w-full rounded mb-2 border border-black/10" loading="lazy" />
                    </a>
                  )}

                  {/* Videos (cover frame via preload=metadata) */}
                  {atts.filter(a => isVideo(a.type)).map(a => (
                    <video
                      key={a.path}
                      src={signedUrls[a.path] ? `${signedUrls[a.path]}#t=0.5` : undefined}
                      controls
                      preload="metadata"
                      playsInline
                      className="w-full rounded mb-2 border border-black/10 bg-black"
                    />
                  ))}

                  {/* Audio */}
                  {atts.filter(a => isAudio(a.type)).map(a => (
                    <audio key={a.path} src={signedUrls[a.path]} controls preload="metadata" className="w-full mb-2" />
                  ))}

                  {/* Rich content */}
                  {n.content && (
                    <div
                      className="prose prose-sm max-w-none text-slate-800 break-words [&>p]:my-1 [&_a]:text-blue-700 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(n.content) }}
                    />
                  )}

                  {/* Link / YouTube embed */}
                  {ytId ? (
                    <div className="mt-2 aspect-video rounded overflow-hidden border border-black/10">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        title="YouTube"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                        allowFullScreen
                      />
                    </div>
                  ) : n.link_url ? (
                    <a href={n.link_url} target="_blank" rel="noreferrer"
                       className="mt-2 flex items-center gap-1.5 text-xs text-blue-700 underline break-all bg-white/60 rounded px-2 py-1 border border-black/5">
                      <Link2 className="w-3 h-3 shrink-0" /> {n.link_url}
                    </a>
                  ) : null}

                  {/* Other files (non-image/video/audio) */}
                  {atts.filter(a => !isImage(a.type) && !isVideo(a.type) && !isAudio(a.type)).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {atts.filter(a => !isImage(a.type) && !isVideo(a.type) && !isAudio(a.type)).map(a => (
                        <a key={a.path} href={signedUrls[a.path] || "#"} target="_blank" rel="noreferrer"
                           className="flex items-center justify-between gap-2 bg-white/70 border border-black/10 rounded px-2 py-1 text-xs hover:bg-white">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <FileText className="w-3.5 h-3.5 shrink-0 text-slate-600" />
                            <span className="truncate">{a.name}</span>
                          </span>
                          <span className="flex items-center gap-1 text-slate-500 shrink-0">
                            <span>{fmtSize(a.size)}</span>
                            <Download className="w-3 h-3" />
                          </span>
                        </a>
                      ))}
                    </div>
                  )}


                  <div className="mt-2 pt-2 border-t border-black/10 flex items-center justify-between text-[10px] text-slate-600 gap-2">
                    <span className="truncate" title={n.created_at ? new Date(n.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : ""}>
                      {n.created_at
                        ? `${new Date(n.created_at).toLocaleDateString("th-TH-u-ca-buddhist", { timeZone: "Asia/Bangkok", day: "2-digit", month: "short", year: "2-digit" })} ${new Date(n.created_at).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })} น. · ${formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: th })}`
                        : ""}
                    </span>
                    <button onClick={() => likeNote(n)} className="flex items-center gap-1 hover:text-rose-600 shrink-0">
                      <Heart className="w-3 h-3" /> {n.likes || 0}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "แก้ไขโน้ต" : "แปะโน้ตใหม่"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <PadletNoteEditor content={contentHtml} onChange={setContentHtml} />

            <div>
              <label className="text-xs font-medium mb-1 block">สีโน้ต</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c.key} type="button" onClick={() => setColor(c.key)}
                    className={`h-8 w-8 rounded border-2 ${c.cls} ${color === c.key ? "ring-2 ring-primary ring-offset-1" : ""}`}
                    title={c.key} />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Link2 className="w-3 h-3" /> ลิงก์ (YouTube แสดงเป็นวิดีโออัตโนมัติ)
              </label>
              <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…" />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> ไฟล์แนบ · รูปภาพ / เอกสาร (สูงสุด 20MB ต่อไฟล์)
              </label>
              <input
                ref={fileRef}
                type="file"
                multiple
                onChange={e => e.target.files && uploadFiles(e.target.files)}
                className="text-xs"
                disabled={uploading}
              />
              {uploading && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> กำลังอัปโหลด…</div>}
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map(a => (
                    <div key={a.path} className="flex items-center justify-between gap-2 border rounded px-2 py-1 text-xs bg-slate-50">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {isImage(a.type) ? <ImageIcon className="w-3.5 h-3.5 text-slate-600" /> : <FileText className="w-3.5 h-3.5 text-slate-600" />}
                        <span className="truncate">{a.name}</span>
                        <span className="text-slate-500">({fmtSize(a.size)})</span>
                      </span>
                      <button type="button" onClick={() => removeAttachment(a)} className="text-destructive hover:text-destructive/80">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>ยกเลิก</Button>
            <Button onClick={submitNote} disabled={saving || uploading}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? "บันทึก" : "แปะโน้ต"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
