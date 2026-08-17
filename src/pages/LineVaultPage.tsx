import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, SUPABASE_RUNTIME_URL, SUPABASE_RUNTIME_ANON_KEY } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DriveConnectCard from "@/components/drive/DriveConnectCard";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
import { Image as ImageIcon, FileText, FileSpreadsheet, Presentation, StickyNote, Download, Trash2, Search, Upload, Users, Building2, Lock, RefreshCw, Settings as SettingsIcon, Copy, ExternalLink, CheckCircle2, XCircle, KeyRound, Eye, EyeOff, Save, Archive, FolderOpen, MessageSquareText } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import JSZip from "jszip";
import { Checkbox } from "@/components/ui/checkbox";
import { getBackendConfig } from "@/lib/runtimeConfig";
import { saveErrorMessage } from "@/lib/saveError";


type Item = {
  id: string;
  source: "line" | "manual";
  kind: "photo" | "file" | "note";
  title: string;
  description: string | null;
  note_text: string | null;
  storage_path: string | null;


  drive_file_id?: string | null;
  drive_web_view_link?: string | null;

  mime_type: string | null;
  size_bytes: number | null;
  original_filename: string | null;
  line_group_id: string | null;
  line_sender_name: string | null;
  line_image_set_id: string | null;
  department: string | null;
  visibility: "everyone" | "department" | "admin";
  category: string | null;
  academic_year: number | null;
  semester: number | null;
  tags: string[];
  created_at: string;
};

type Group = {
  id: string;
  line_group_id: string;
  group_name: string;
  department: string | null;
  default_visibility: "everyone" | "department" | "admin";
  default_category: string | null;
  auto_capture: boolean;
  notify_on_capture?: boolean;
  notify_cooldown_minutes?: number;
  notes: string | null;
  drive_root_folder_id?: string | null;
  notify_leaves?: boolean;
  notify_substitute?: boolean;
  notify_calendar?: boolean;
  notify_attendance?: boolean;
  drive_root_url?: string | null;
  drive_folder_id?: string | null;
};

function parseDriveFolderId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  // If it's already an ID (no slashes, reasonable length)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s) && !s.includes("/")) return s;
  const m1 = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "circular", label: "หนังสือเวียน" },
  { value: "document", label: "เอกสาร/หนังสือราชการ" },
  { value: "meeting", label: "ประชุม" },
  { value: "training", label: "อบรม/สัมมนา" },
  { value: "activity", label: "กิจกรรม/รูปกิจกรรม" },
  { value: "announcement", label: "ประกาศ" },
  { value: "report", label: "รายงาน" },
  { value: "other", label: "อื่นๆ" },
];
const categoryLabel = (v: string | null) => CATEGORIES.find(c => c.value === v)?.label || "ไม่ระบุ";

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

// ---------- Signed-URL cache + lazy thumbnail + inline preview ----------
// Streams file bytes through our own edge function (RLS-checked) and returns
// a blob: URL that <img>/<video>/<audio>/<iframe> can consume without needing
// to send Authorization headers. This works for Google Drive files too, which
// can't be embedded via webContentLink from a private account.
const _urlCache = new Map<string, { url: string; ts: number }>();
const SUPABASE_URL = getBackendConfig().url;
const SUPABASE_ANON = getBackendConfig().anonKey;

async function getSignedUrl(itemId: string): Promise<string | null> {
  const cached = _urlCache.get(itemId);
  if (cached && Date.now() - cached.ts < 50 * 60 * 1000) return cached.url;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return null;
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/line-vault-stream?id=${encodeURIComponent(itemId)}`,
      { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON } },
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    _urlCache.set(itemId, { url, ts: Date.now() });
    return url;
  } catch (e) {
    console.error("[getSignedUrl]", e);
    return null;
  }
}

function useInView<T extends Element>(rootMargin = "200px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { setInView(true); io.disconnect(); } });
    }, { rootMargin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}

function isImageMime(m?: string | null) { return !!m && m.startsWith("image/"); }
function isVideoMime(m?: string | null) { return !!m && m.startsWith("video/"); }
function isAudioMime(m?: string | null) { return !!m && m.startsWith("audio/"); }
function isPdfMime(m?: string | null, name?: string | null) {
  return (m === "application/pdf") || (!!name && /\.pdf$/i.test(name));
}
function isOfficeMime(m?: string | null, name?: string | null) {
  if (!!name && /\.(docx?|xlsx?|pptx?)$/i.test(name)) return true;
  if (!m) return false;
  return m.includes("word") || m.includes("excel") || m.includes("spreadsheet") || m.includes("presentation") || m.includes("powerpoint");
}

function fileExtension(name?: string | null) {
  const match = name?.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toUpperCase() ?? "FILE";
}

function DocumentThumb({ item, url }: { item: Item; url: string | null }) {
  const [pdfImage, setPdfImage] = useState<string | null>(null);
  const isPdf = isPdfMime(item.mime_type, item.original_filename);
  const ext = fileExtension(item.original_filename);

  useEffect(() => {
    if (!isPdf || !url || pdfImage) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const worker = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const bytes = await fetch(url).then((response) => response.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(1.5, 420 / base.width) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) return;
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (!cancelled) setPdfImage(canvas.toDataURL("image/jpeg", 0.78));
      } catch (error) {
        console.error("[LineVault PDF thumbnail]", error);
      }
    })();
    return () => { cancelled = true; };
  }, [isPdf, pdfImage, url]);

  if (pdfImage) return <img src={pdfImage} alt={`ตัวอย่าง ${item.title}`} className="h-full w-full object-cover object-top" />;

  const Icon = /XLS|XLSX|CSV/.test(ext) ? FileSpreadsheet : /PPT|PPTX/.test(ext) ? Presentation : FileText;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-4">
      <Icon className="h-12 w-12 text-primary/75" />
      <span className="rounded bg-background px-2 py-1 text-xs font-semibold text-foreground shadow-sm">{ext}</span>
      <span className="max-w-full truncate text-xs text-muted-foreground">{item.original_filename || item.title}</span>
    </div>
  );
}

function LineVaultThumb({ item, className }: { item: Item; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [url, setUrl] = useState<string | null>(null);
  const [videoPoster, setVideoPoster] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const isImg = isImageMime(item.mime_type) || item.kind === "photo";
  const isVid = isVideoMime(item.mime_type);
  const wantThumb = isImg || isVid || item.kind === "file";

  useEffect(() => {
    if (!inView || !wantThumb || url) return;
    getSignedUrl(item.id).then(u => { setUrl(u); if (!u) setErr(true); }).catch(() => setErr(true));
  }, [inView, wantThumb, item.id, url]);

  // Generate poster frame from video once we have a blob URL
  useEffect(() => {
    if (!isVid || !url || videoPoster) return;
    let cancelled = false;
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    (video as any).playsInline = true;
    video.src = url;
    const onLoaded = () => {
      try { video.currentTime = Math.min(0.1, (video.duration || 1) / 2); } catch { /* ignore */ }
    };
    const onSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 180;
        const scale = Math.min(1, 480 / Math.max(w, h));
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          if (!cancelled) setVideoPoster(dataUrl);
        }
      } catch { if (!cancelled) setErr(true); }
      video.removeAttribute("src");
      video.load();
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", () => { if (!cancelled) setErr(true); });
    return () => { cancelled = true; video.removeEventListener("loadedmetadata", onLoaded); video.removeEventListener("seeked", onSeeked); };
  }, [isVid, url, videoPoster]);

  const posterSrc = isVid ? videoPoster : (url && !err ? url : null);

  return (
    <div ref={ref as any} className={className}>
      {isImg && posterSrc && !err ? (
        <div className="relative w-full h-full">
          <img
            src={posterSrc}
            loading="lazy"
            alt={item.title}
            onError={() => setErr(true)}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full object-cover select-none"
            draggable={false}
          />
          {isVid && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="h-12 w-12 rounded-full bg-black/60 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white ml-0.5"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
          )}
        </div>
      ) : isVid && posterSrc && !err ? (
        <div className="relative h-full w-full">
          <img src={posterSrc} alt={item.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80 text-foreground">▶</div>
          </div>
        </div>
      ) : item.kind === "file" && !isVid ? (
        <DocumentThumb item={item} url={url} />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          {isVid
            ? <div className="h-12 w-12 rounded-full bg-black/40 flex items-center justify-center"><svg viewBox="0 0 24 24" className="h-6 w-6 fill-white ml-0.5"><path d="M8 5v14l11-7z"/></svg></div>
            : isPdfMime(item.mime_type, item.original_filename)
              ? <FileText className="h-10 w-10 text-red-500/70" />
              : <FileText className="h-10 w-10 text-muted-foreground" />}
        </div>
      )}
    </div>
  );
}

function LineVaultPreviewDialog({ item, onClose, onDownload }: { item: Item | null; onClose: () => void; onDownload: (i: Item) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!item) { setUrl(null); return; }
    setLoading(true);
    getSignedUrl(item.id).then(u => { setUrl(u); setLoading(false); });
  }, [item?.id]);

  if (!item) return null;
  const isImg = isImageMime(item.mime_type) || item.kind === "photo";
  const isVid = isVideoMime(item.mime_type);
  const isAud = isAudioMime(item.mime_type);
  const isPdf = isPdfMime(item.mime_type, item.original_filename);
  const isOffice = isOfficeMime(item.mime_type, item.original_filename);
  const officeViewer = url && isOffice ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}` : null;

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {item.kind === "photo" ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            <span className="line-clamp-1">{item.title}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          {item.line_sender_name && <Badge variant="secondary" className="text-[10px]">จาก LINE · {item.line_sender_name}</Badge>}
          <span>{item.original_filename} · {formatBytes(item.size_bytes)}</span>
          <span>· {format(new Date(item.created_at), "d MMM yyyy HH:mm", { locale: th })}</span>
        </div>
        {item.description && (
          <div className="text-sm bg-muted/50 rounded p-3 flex items-start gap-2">
            <MessageSquareText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="whitespace-pre-wrap">{item.description}</div>
          </div>
        )}
        <div className="min-h-[300px] max-h-[70vh] overflow-auto rounded border bg-black/5 dark:bg-white/5 flex items-center justify-center">
          {loading || !url ? (
            <div className="text-sm text-muted-foreground py-16">กำลังโหลด...</div>
          ) : isImg ? (
            <img src={url} alt={item.title} className="max-h-[70vh] object-contain" onContextMenu={(e) => e.preventDefault()} draggable={false} />
          ) : isVid ? (
            <video src={url} controls playsInline className="max-h-[70vh] w-full bg-black" />
          ) : isAud ? (
            <audio src={url} controls className="w-full my-6" />
          ) : isPdf ? (
            <iframe src={url} title={item.title} className="w-full h-[70vh]" />
          ) : officeViewer ? (
            <iframe src={officeViewer} title={item.title} className="w-full h-[70vh]" />
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              ไม่รองรับการแสดงตัวอย่างสำหรับไฟล์ประเภทนี้ กรุณาดาวน์โหลดเพื่อเปิด
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => onDownload(item)}><Download className="h-4 w-4 mr-1" />ดาวน์โหลด</Button>
          {url && <Button variant="outline" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" />เปิดในแท็บใหม่</a></Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LineVaultPage() {
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "director";
  const [tab, setTab] = useState<"all" | "photo" | "file" | "note" | "manage" | "settings">("all");
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [semFilter, setSemFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("line_vault_items")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(saveErrorMessage(error));
    setItems((data as any) || []);
    if (isAdmin) {
      const { data: g } = await supabase.from("line_vault_groups").select("*").order("created_at", { ascending: false });
      setGroups((g as any) || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [isAdmin]);

  const yearOptions = useMemo(() => {
    const s = new Set<number>();
    items.forEach(i => { if (i.academic_year) s.add(i.academic_year); });
    return Array.from(s).sort((a, b) => b - a);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (tab !== "all" && tab !== "manage" && tab !== "settings" && i.kind !== tab) return false;
      if (yearFilter !== "all" && String(i.academic_year || "") !== yearFilter) return false;
      if (semFilter !== "all" && String(i.semester || "") !== semFilter) return false;
      if (catFilter !== "all" && (i.category || "other") !== catFilter) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (i.title || "").toLowerCase().includes(s)
        || (i.note_text || "").toLowerCase().includes(s)
        || (i.original_filename || "").toLowerCase().includes(s)
        || (i.line_sender_name || "").toLowerCase().includes(s);
    });
  }, [items, tab, q, yearFilter, semFilter, catFilter]);


  async function handleOpen(item: Item) {
    if (item.kind === "note") {
      await swal.confirm({
        title: item.title,
        text: item.note_text || "",
        confirmText: "ปิด",
      });
      return;
    }
    const { data, error } = await supabase.functions.invoke("line-vault-download", {
      body: { item_id: item.id, expires_in: 600 },
    });
    if (error || !data?.url) {
      swal.error("ดาวน์โหลดไม่สำเร็จ", (data as any)?.error || error?.message);
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
    const ok = await swal.confirm({ title: "ลบรายการนี้?", text: item.title, confirmText: "ลบ", danger: true });
    if (!ok) return;
    const { data, error } = await supabase.functions.invoke("line-vault-delete", { body: { item_id: item.id } });
    if (error || (data as any)?.error) return swal.error("ลบไม่สำเร็จ", (data as any)?.error || error?.message);
    swal.success("ลบแล้ว");
    load();
  }

  async function handleBulkDelete(itemsToDelete: Item[]) {
    if (!itemsToDelete.length) return false;
    const ok = await swal.confirm({
      title: `ลบ ${itemsToDelete.length} รายการ?`,
      text: "รายการและไฟล์ใน Google Drive จะถูกลบถาวร ไม่สามารถกู้คืนได้",
      confirmText: "ลบทั้งหมด",
      danger: true,
    });
    if (!ok) return false;
    const { data, error } = await supabase.functions.invoke("line-vault-delete", {
      body: { item_ids: itemsToDelete.map(i => i.id) },
    });
    if (error || (data as any)?.error) {
      swal.error("ลบไม่สำเร็จ", (data as any)?.error || error?.message);
      return false;
    }
    swal.success(`ลบแล้ว ${(data as any)?.deleted ?? itemsToDelete.length} รายการ`);
    load();
    return true;
  }

  async function fetchItemBlob(item: Item): Promise<{ blob: Blob; filename: string } | null> {
    if (item.kind === "note") {
      const text = `${item.title}\n\n${item.note_text || ""}\n\n— ${format(new Date(item.created_at), "d MMM yyyy HH:mm", { locale: th })}`;
      return { blob: new Blob([text], { type: "text/plain;charset=utf-8" }), filename: `${item.title.replace(/[\\/:*?"<>|]/g, "_") || "note"}.txt` };
    }
    const { data } = await supabase.functions.invoke("line-vault-download", { body: { item_id: item.id, expires_in: 600 } });
    if (!data?.url) return null;
    try {
      const res = await fetch(data.url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return { blob, filename: data.filename || item.original_filename || item.title || item.id };
    } catch { return null; }
  }
  const legacyDriveOnly = useMemo(
    () => items.filter(i => i.kind !== "note" && !i.storage_path && i.drive_file_id).length,
    [items],
  );

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

      {isAdmin && legacyDriveOnly > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">
            มี {legacyDriveOnly} ไฟล์เก่าที่ยังเก็บอยู่บน Google Drive อย่างเดียว จึงยังแสดงตัวอย่างไม่ได้
          </p>
          <p className="mt-1 text-muted-foreground">
            หลังย้ายฐานข้อมูล ระบบยังไม่ได้เชื่อมบัญชี Google Drive ใหม่ ทำให้ดึงไฟล์เก่ามาแสดงไม่ได้
            กรุณาไปที่แท็บ “ตั้งค่า Vault OA” → เชื่อม Google Drive แล้วกด “เริ่มสำรองไฟล์” เพื่อคัดลอกไฟล์เก่าเข้าระบบให้แสดงตัวอย่างได้ถาวร
          </p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setTab("settings")}>
            ไปที่การตั้งค่า Drive
          </Button>
        </div>
      )}


      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">ทั้งหมด <Badge variant="secondary" className="ml-2">{items.length}</Badge></TabsTrigger>
          <TabsTrigger value="photo"><ImageIcon className="h-4 w-4 mr-1" />รูปภาพ</TabsTrigger>
          <TabsTrigger value="file"><FileText className="h-4 w-4 mr-1" />ไฟล์</TabsTrigger>
          <TabsTrigger value="note"><StickyNote className="h-4 w-4 mr-1" />โน้ต</TabsTrigger>
          {isAdmin && <TabsTrigger value="manage"><Users className="h-4 w-4 mr-1" />จัดการกลุ่ม</TabsTrigger>}
          {isAdmin && <TabsTrigger value="settings"><SettingsIcon className="h-4 w-4 mr-1" />ตั้งค่า Vault OA</TabsTrigger>}
        </TabsList>

        <div className="mt-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ · ไฟล์ · ข้อความ · ผู้ส่ง" className="pl-9" />
            </div>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="ปีการศึกษา" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกปีการศึกษา</SelectItem>
                {yearOptions.map(y => <SelectItem key={y} value={String(y)}>ปี {y + 543}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={semFilter} onValueChange={setSemFilter}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="เทอม" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกเทอม</SelectItem>
                <SelectItem value="1">เทอม 1</SelectItem>
                <SelectItem value="2">เทอม 2</SelectItem>
              </SelectContent>
            </Select>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="ประเภท" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="all" className="m-0"><ItemGrid items={filtered} loading={loading} isAdmin={isAdmin} onOpen={handleOpen} onDelete={handleDelete} onBulkDelete={handleBulkDelete} fetchBlob={fetchItemBlob} groupAlbums /></TabsContent>
          <TabsContent value="photo" className="m-0"><ItemGrid items={filtered} loading={loading} isAdmin={isAdmin} onOpen={handleOpen} onDelete={handleDelete} onBulkDelete={handleBulkDelete} fetchBlob={fetchItemBlob} groupAlbums /></TabsContent>
          <TabsContent value="file" className="m-0"><ItemGrid items={filtered} loading={loading} isAdmin={isAdmin} onOpen={handleOpen} onDelete={handleDelete} onBulkDelete={handleBulkDelete} fetchBlob={fetchItemBlob} /></TabsContent>
          <TabsContent value="note" className="m-0"><ItemGrid items={filtered} loading={loading} isAdmin={isAdmin} onOpen={handleOpen} onDelete={handleDelete} onBulkDelete={handleBulkDelete} fetchBlob={fetchItemBlob} /></TabsContent>



          {isAdmin && (
            <TabsContent value="manage" className="m-0">
              <GroupsManager groups={groups} onChange={load} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="settings" className="m-0 space-y-4">
              <DriveConnectCard />
              <StorageBackfillCard onDone={load} />
              <VaultSettings />
            </TabsContent>

          )}
        </div>
      </Tabs>
    </div>
  );
}

function ItemGrid({ items, loading, isAdmin, onOpen, onDelete, onBulkDelete, fetchBlob, groupAlbums }: { items: Item[]; loading: boolean; isAdmin: boolean; onOpen: (i: Item) => void; onDelete: (i: Item) => void; onBulkDelete?: (items: Item[]) => Promise<boolean>; fetchBlob: (i: Item) => Promise<{ blob: Blob; filename: string } | null>; groupAlbums?: boolean }) {
  const [albumOpen, setAlbumOpen] = useState<Item[] | null>(null);
  const [previewItem, setPreviewItem] = useState<Item | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const openItem = (i: Item) => {
    if (i.kind === "note") { onOpen(i); return; }
    setPreviewItem(i);
  };
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

  const toggle = (id: string) => setSelected(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });
  const clearSel = () => setSelected(new Set());

  async function downloadZip(itemsToZip: Item[], zipName: string) {
    if (!itemsToZip.length) return;
    setZipping(true);
    setZipProgress({ done: 0, total: itemsToZip.length });
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      let done = 0;
      // Sequential fetch to avoid overwhelming edge function + signed url quota
      for (const it of itemsToZip) {
        const res = await fetchBlob(it);
        done += 1;
        setZipProgress({ done, total: itemsToZip.length });
        if (!res) continue;
        let name = res.filename;
        if (usedNames.has(name)) {
          const dot = name.lastIndexOf(".");
          const base = dot > 0 ? name.slice(0, dot) : name;
          const ext = dot > 0 ? name.slice(dot) : "";
          let i = 2;
          while (usedNames.has(`${base}_${i}${ext}`)) i++;
          name = `${base}_${i}${ext}`;
        }
        usedNames.add(name);
        // Prefix with date for clarity
        const datePrefix = format(new Date(it.created_at), "yyyy-MM-dd");
        zip.file(`${datePrefix}_${name}`, res.blob);
        // If item has a caption/description, include as sidecar text
        if (it.description && it.description.trim()) {
          zip.file(`${datePrefix}_${name}.caption.txt`, it.description);
        }
      }
      const blob = await zip.generateAsync({ type: "blob" }, (meta) => {
        setZipProgress({ done: itemsToZip.length, total: itemsToZip.length });
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${zipName}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`ดาวน์โหลด ZIP สำเร็จ (${itemsToZip.length} ไฟล์)`);
      clearSel();
    } catch (e: any) {
      swal.error("สร้าง ZIP ไม่สำเร็จ", e?.message);
    } finally {
      setZipping(false);
      setZipProgress(null);
    }
  }

  const rows = useMemo(() => {
    if (!groupAlbums) return items.map(i => ({ kind: "item" as const, item: i }));
    const albums = new Map<string, Item[]>();
    const singles: Item[] = [];
    for (const i of items) {
      if (i.line_image_set_id) {
        const arr = albums.get(i.line_image_set_id) || [];
        arr.push(i);
        albums.set(i.line_image_set_id, arr);
      } else singles.push(i);
    }
    const out: Array<{ kind: "item"; item: Item } | { kind: "album"; items: Item[] }> = [];
    for (const [, arr] of albums) {
      if (arr.length > 1) out.push({ kind: "album", items: arr });
      else singles.push(arr[0]);
    }
    for (const i of singles) out.push({ kind: "item", item: i });
    out.sort((a, b) => {
      const ta = a.kind === "album" ? a.items[0].created_at : a.item.created_at;
      const tb = b.kind === "album" ? b.items[0].created_at : b.item.created_at;
      return tb.localeCompare(ta);
    });
    return out;
  }, [items, groupAlbums]);

  if (loading) return <div className="text-center py-10 text-muted-foreground">กำลังโหลด...</div>;
  if (!rows.length) return <div className="text-center py-16 text-muted-foreground">ยังไม่มีรายการ</div>;

  const selectedItems = items.filter(i => selected.has(i.id));

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 mb-3 flex items-center gap-2 flex-wrap rounded-lg border bg-background/95 backdrop-blur px-3 py-2 shadow-sm">
          <Badge variant="secondary">เลือก {selected.size} รายการ</Badge>
          <Button size="sm" onClick={() => downloadZip(selectedItems, `LineVault_${format(new Date(), "yyyyMMdd_HHmm")}`)} disabled={zipping}>
            <Archive className="h-4 w-4 mr-1" />
            {zipping ? `กำลังบีบอัด ${zipProgress?.done || 0}/${zipProgress?.total || 0}...` : "ดาวน์โหลดเป็น ZIP"}
          </Button>
          {isAdmin && onBulkDelete && (
            <Button
              size="sm"
              variant="destructive"
              disabled={zipping}
              onClick={async () => {
                const ok = await onBulkDelete(selectedItems);
                if (ok) clearSel();
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />ลบที่เลือก
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={clearSel} disabled={zipping}>ยกเลิกการเลือก</Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {rows.map((row, idx) => {
          if (row.kind === "album") {
            const first = row.items[0];
            const albumDesc = row.items.find(x => x.description)?.description || null;
            const albumIds = row.items.map(x => x.id);
            const allSel = albumIds.every(id => selected.has(id));
            return (
              <Card key={`album-${first.line_image_set_id}`} className="overflow-hidden hover:shadow-md transition-shadow">
                <button type="button" onClick={() => setAlbumOpen(row.items)} className="block w-full aspect-video relative group">
                  <LineVaultThumb item={first} className="w-full h-full" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white rounded px-1.5 py-0.5 inline-flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" />{row.items.length}
                  </div>
                </button>
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allSel}
                        onCheckedChange={(v) => setSelected(prev => {
                          const s = new Set(prev);
                          if (v) albumIds.forEach(id => s.add(id));
                          else albumIds.forEach(id => s.delete(id));
                          return s;
                        })}
                      />
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${kindMeta.photo.color}`}>
                        <FolderOpen className="h-3 w-3" />อัลบั้ม · {row.items.length} รูป
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{categoryLabel(first.category)}</Badge>
                  </div>
                  <div className="font-medium line-clamp-2 min-h-[2.5rem] cursor-pointer" onClick={() => setAlbumOpen(row.items)}>
                    อัลบั้มจาก {first.line_sender_name || "LINE"}
                  </div>
                  {albumDesc && (
                    <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap flex items-start gap-1">
                      <MessageSquareText className="h-3 w-3 mt-0.5 shrink-0" />{albumDesc}
                    </p>
                  )}
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>{first.academic_year ? `ปี ${first.academic_year + 543}/${first.semester || "-"}` : ""}</span>
                    <span>{format(new Date(first.created_at), "d MMM yyyy HH:mm", { locale: th })}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1" onClick={() => setAlbumOpen(row.items)}>
                      <FolderOpen className="h-4 w-4 mr-1" />เปิด
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadZip(row.items, `Album_${format(new Date(first.created_at), "yyyyMMdd_HHmm")}`)} disabled={zipping} title="ดาวน์โหลดทั้งอัลบั้มเป็น ZIP">
                      <Archive className="h-4 w-4" />
                    </Button>
                    {isAdmin && onBulkDelete && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onBulkDelete(row.items)} title="ลบทั้งอัลบั้ม">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          }
          const item = row.item;
          const M = kindMeta[item.kind];
          const Icon = M.icon;
          const isSel = selected.has(item.id);
          return (
            <Card key={item.id} className={`overflow-hidden hover:shadow-md transition-shadow ${isSel ? "ring-2 ring-primary" : ""}`}>
              {item.kind !== "note" && (
                <button type="button" onClick={() => openItem(item)} className="block w-full aspect-video relative group">
                  <LineVaultThumb item={item} className="w-full h-full" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  {isVideoMime(item.mime_type) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-black/60 text-white rounded-full h-10 w-10 flex items-center justify-center">▶</div>
                    </div>
                  )}
                </button>
              )}
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isSel} onCheckedChange={() => toggle(item.id)} />
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${M.color}`}>
                      <Icon className="h-3 w-3" />{M.label}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {item.visibility === "everyone" ? <Users className="h-3 w-3 mr-0.5" /> : item.visibility === "department" ? <Building2 className="h-3 w-3 mr-0.5" /> : <Lock className="h-3 w-3 mr-0.5" />}
                    {visMeta[item.visibility]}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px]">{categoryLabel(item.category)}</Badge>
                  {item.academic_year && <Badge variant="outline" className="text-[10px]">ปี {item.academic_year + 543}/{item.semester || "-"}</Badge>}
                  {item.line_sender_name && (
                    <Badge variant="outline" className="text-[10px] max-w-[160px] truncate" title={item.line_sender_name}>
                      จาก LINE · {item.line_sender_name}
                    </Badge>
                  )}
                </div>
                <div className="font-medium line-clamp-2 min-h-[2.5rem]" title={item.title}>{item.title}</div>
                {item.kind === "note" && item.note_text && (
                  <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{item.note_text}</p>
                )}
                {item.kind !== "note" && item.description && (
                  <p className="text-xs text-foreground/80 line-clamp-3 whitespace-pre-wrap flex items-start gap-1 bg-muted/40 rounded px-2 py-1">
                    <MessageSquareText className="h-3 w-3 mt-0.5 shrink-0" />{item.description}
                  </p>
                )}
                {item.kind !== "note" && (
                  <div className="text-xs text-muted-foreground truncate" title={item.original_filename || undefined}>
                    {item.original_filename} · {formatBytes(item.size_bytes)}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>{item.line_sender_name ? `จาก ${item.line_sender_name}` : item.source === "manual" ? "อัปโหลดเอง" : "จาก LINE"}</span>
                  <span>{format(new Date(item.created_at), "d MMM yyyy HH:mm", { locale: th })}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1" onClick={() => openItem(item)}>
                    {item.kind === "note" ? <><StickyNote className="h-4 w-4 mr-1" />เปิด</> : <><Eye className="h-4 w-4 mr-1" />ดูตัวอย่าง</>}
                  </Button>
                  {item.kind !== "note" && (
                    <Button size="sm" variant="outline" onClick={() => onOpen(item)} title="ดาวน์โหลดไฟล์">
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => onDelete(item)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!albumOpen} onOpenChange={(o) => !o && setAlbumOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <FolderOpen className="h-5 w-5" />
              อัลบั้มรูป · {albumOpen?.length || 0} รูป
              {albumOpen?.[0] && (
                <span className="text-xs font-normal text-muted-foreground">
                  · {format(new Date(albumOpen[0].created_at), "d MMM yyyy HH:mm", { locale: th })}
                  {albumOpen[0].line_sender_name ? ` · จาก ${albumOpen[0].line_sender_name}` : ""}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {(albumOpen?.find(x => x.description)?.description) && (
            <div className="text-sm bg-muted/50 rounded p-3 flex items-start gap-2">
              <MessageSquareText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="whitespace-pre-wrap">{albumOpen!.find(x => x.description)!.description}</div>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={() => albumOpen && downloadZip(albumOpen, `Album_${format(new Date(albumOpen[0].created_at), "yyyyMMdd_HHmm")}`)} disabled={zipping || !albumOpen?.length}>
              <Archive className="h-4 w-4 mr-1" />
              {zipping ? `กำลังบีบอัด ${zipProgress?.done || 0}/${zipProgress?.total || 0}...` : "ดาวน์โหลดทั้งอัลบั้ม (ZIP)"}
            </Button>
            <span className="text-xs text-muted-foreground">คลิกที่รูปเพื่อดูตัวอย่าง</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
            {albumOpen?.map(p => (
              <button key={p.id} onClick={() => { setAlbumOpen(null); setPreviewItem(p); }} className="border rounded p-2 hover:bg-muted text-left space-y-1">
                <div className="aspect-square rounded overflow-hidden">
                  <LineVaultThumb item={p} className="w-full h-full" />
                </div>
                <div className="text-xs truncate">{p.original_filename || p.title}</div>
                <div className="text-[10px] text-muted-foreground flex items-center justify-between gap-1">
                  <span className="truncate">{p.line_sender_name ? `จาก ${p.line_sender_name}` : ""}</span>
                  <span>{formatBytes(p.size_bytes)}</span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>

      </Dialog>

      <LineVaultPreviewDialog
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onDownload={(i) => onOpen(i)}
      />
    </>
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
      swal.success("อัปโหลดสำเร็จ");
      setOpen(false); setTitle(""); setNoteText(""); setFile(null);
      onDone();
    } catch (e: any) { swal.error("อัปโหลดไม่สำเร็จ", e.message); }
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
  async function update(id: string, patch: Record<string, any>) {
    const { error } = await supabase.from("line_vault_groups").update(patch as any).eq("id", id);
    if (error) return swal.error("บันทึกไม่สำเร็จ", error.message);
    onChange();
  }
  async function remove(id: string) {
    const ok = await swal.confirm({ title: "ลบกลุ่มนี้?", text: "รายการที่จับไปแล้วยังคงอยู่", confirmText: "ลบ", danger: true });
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
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">จับอัตโนมัติ</span>
                  <Switch checked={g.auto_capture} onCheckedChange={(v) => update(g.id, { auto_capture: v })} />
                </label>
                <label className="flex items-center gap-2" title="ตอบกลับในกลุ่มหลังจัดเก็บ (ใช้ reply token — ไม่เสียโควตา push)">
                  <span className="text-muted-foreground">แจ้งกลับในกลุ่ม (ฟรี)</span>
                  <Switch checked={g.notify_on_capture !== false} onCheckedChange={(v) => update(g.id, { notify_on_capture: v } as any)} />
                </label>
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
              <label className="flex items-center gap-1" title="ระยะเวลาขั้นต่ำระหว่างการตอบกลับในกลุ่ม (0 = ตอบทุกครั้ง)">
                <span className="text-muted-foreground">ตอบกลับทุก</span>
                <Input
                  type="number" min={0} max={60}
                  className="w-16 h-8"
                  defaultValue={g.notify_cooldown_minutes ?? 3}
                  onBlur={(e) => {
                    const n = Math.max(0, Math.min(60, parseInt(e.target.value || "0", 10)));
                    if (n !== (g.notify_cooldown_minutes ?? 3)) update(g.id, { notify_cooldown_minutes: n } as any);
                  }}
                />
                <span className="text-muted-foreground">นาที</span>
              </label>
              <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="pt-2 border-t space-y-1.5">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                📁 โฟลเดอร์ Google Drive ปลายทาง (วางลิงก์โฟลเดอร์)
              </Label>
              <div className="flex gap-2 items-center">
                <Input
                  className="text-xs font-mono"
                  placeholder="https://drive.google.com/drive/folders/xxxxx  หรือเว้นว่างเพื่อใช้ค่าเริ่มต้น LineVault/{ปี}/{ชื่อกลุ่ม}/{เดือน}"
                  defaultValue={g.drive_root_url || ""}
                  onBlur={async (e) => {
                    const raw = e.target.value.trim();
                    if (raw === (g.drive_root_url || "")) return;
                    if (!raw) {
                      await update(g.id, { drive_root_url: null, drive_root_folder_id: null } as any);
                      return;
                    }
                    const id = parseDriveFolderId(raw);
                    if (!id) return swal.error("ลิงก์ไม่ถูกต้อง", "รองรับลิงก์รูปแบบ https://drive.google.com/drive/folders/{id}");
                    await update(g.id, { drive_root_url: raw, drive_root_folder_id: id } as any);
                  }}
                />
                {g.drive_root_url && (
                  <a href={g.drive_root_url} target="_blank" rel="noreferrer" className="shrink-0">
                    <Button type="button" size="icon" variant="outline" title="เปิดโฟลเดอร์">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                )}
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                {g.drive_root_folder_id
                  ? <>ไฟล์ใหม่จะถูกเก็บที่ <b>โฟลเดอร์ที่เลือก / {new Date().getFullYear()} / {String(new Date().getMonth()+1).padStart(2,"0")}</b> — ระบบจะสร้างโฟลเดอร์ย่อยตามปี/เดือนให้อัตโนมัติ</>
                  : <>ยังไม่ได้ตั้ง — จะใช้ค่าเริ่มต้น <b>LineVault / {new Date().getFullYear()} / {g.group_name || "{ชื่อกลุ่ม}"} / {String(new Date().getMonth()+1).padStart(2,"0")}</b></>
                }
              </p>
            </div>
            <div className="pt-2 border-t space-y-2">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                🔔 การแจ้งเตือนเข้ากลุ่ม LINE นี้
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <label className="flex items-center justify-between gap-2 border rounded-md px-2.5 py-1.5">
                  <span>การขอ/อนุมัติลา</span>
                  <Switch checked={!!g.notify_leaves} onCheckedChange={(v) => update(g.id, { notify_leaves: v } as any)} />
                </label>
                <label className="flex items-center justify-between gap-2 border rounded-md px-2.5 py-1.5">
                  <span>มอบหมายสอนแทน</span>
                  <Switch checked={!!g.notify_substitute} onCheckedChange={(v) => update(g.id, { notify_substitute: v } as any)} />
                </label>
                <label className="flex items-center justify-between gap-2 border rounded-md px-2.5 py-1.5">
                  <span>ปฏิทินรายวัน 07:00</span>
                  <Switch checked={!!g.notify_calendar} onCheckedChange={(v) => update(g.id, { notify_calendar: v } as any)} />
                </label>
                <label className="flex items-center justify-between gap-2 border rounded-md px-2.5 py-1.5">
                  <span>รายงานการมาโรงเรียน (จ.–ศ. 10:00)</span>
                  <Switch checked={!!g.notify_attendance} onCheckedChange={(v) => update(g.id, { notify_attendance: v } as any)} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm" variant="outline"
                  onClick={async () => {
                    const { data, error } = await supabase.functions.invoke("notify-calendar-digest", { body: {} });
                    if (error) return swal.error("ทดสอบไม่สำเร็จ", error.message);
                    swal.success("ส่งทดสอบสำเร็จ", `กลุ่มที่รับ: ${data?.count ?? 0}`);
                  }}
                >ทดสอบสรุปปฏิทิน</Button>
                <Button
                  size="sm" variant="outline"
                  onClick={async () => {
                    const { data, error } = await supabase.functions.invoke("notify-attendance-digest", { body: { group_id: g.id } });
                    if (error) return swal.error("ทดสอบไม่สำเร็จ", error.message);
                    swal.success("ส่งทดสอบสำเร็จ", `รวม ${data?.totals?.totalAll ?? 0} คน`);
                  }}
                >ทดสอบรายงานการมาโรงเรียน</Button>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">Group ID: {g.line_group_id}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function VaultSettings() {
  const SUPABASE_URL = getBackendConfig().url;
  const webhookUrl = `${SUPABASE_URL}/functions/v1/line-vault-webhook`;
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{ token: boolean; webhook_ok?: boolean; error?: string; groups?: number; items?: number } | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [savingToken, setSavingToken] = useState(false);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("คัดลอกแล้ว");
  }

  async function checkStatus() {
    setChecking(true);
    try {
      // Primary source of truth: the app_secrets row itself
      const { data: row } = await supabase
        .from("app_secrets" as any)
        .select("value")
        .eq("key", "LINE_VAULT_CHANNEL_ACCESS_TOKEN")
        .maybeSingle();
      const dbHasToken = !!(row as any)?.value && String((row as any).value).trim().length > 0;

      // Best-effort: also ping the webhook to see if env is already synced
      let envHasToken = false;
      let webhookOk = true;
      let errMsg: string | undefined;
      try {
        const { data, error } = await supabase.functions.invoke("line-vault-webhook", {
          body: { __ping: true },
        });
        envHasToken = !!(data as any)?.token_configured;
        webhookOk = !error;
        errMsg = error?.message;
      } catch (e: any) {
        webhookOk = false;
        errMsg = e?.message;
      }

      const [{ count: groups }, { count: items }] = await Promise.all([
        supabase.from("line_vault_groups").select("*", { count: "exact", head: true }),
        supabase.from("line_vault_items").select("*", { count: "exact", head: true }),
      ]);
      setStatus({
        token: dbHasToken || envHasToken,
        webhook_ok: webhookOk,
        error: errMsg,
        groups: groups || 0,
        items: items || 0,
      });
    } catch (e: any) {
      setStatus({ token: false, webhook_ok: false, error: e.message });
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { checkStatus(); /* eslint-disable-next-line */ }, []);

  async function saveToken() {
    const value = tokenDraft.trim();
    if (!value) { toast.error("กรุณาวาง Channel Access Token ก่อน"); return; }
    setSavingToken(true);
    try {
      // Ensure default row exists then upsert value
      try { await supabase.rpc("ensure_default_app_secrets" as any); } catch (_) { /* ignore */ }
      const { error } = await supabase
        .from("app_secrets" as any)
        .upsert(
          { key: "LINE_VAULT_CHANNEL_ACCESS_TOKEN", value, category: "line", description: "Channel Access Token ของ LINE OA สำหรับ Vault", updated_at: new Date().toISOString() } as any,
          { onConflict: "key" } as any,
        );
      if (error) throw error;
      try { await supabase.functions.invoke("sync-env-secrets"); } catch (_) { /* ignore */ }
      toast.success("บันทึก LINE_VAULT_CHANNEL_ACCESS_TOKEN แล้ว");
      setTokenDraft("");
      setShowToken(false);
      await checkStatus();
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSavingToken(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />LINE OA แยกสำหรับ Vault</CardTitle>
          <p className="text-sm text-muted-foreground">
            ระบบนี้ใช้ LINE Official Account <b>คนละตัว</b>กับแชทบอทของระบบ
            เพื่อไม่ให้ปะปนกัน — ให้สร้าง OA ใหม่แล้วนำ Access Token มาตั้งเป็น secret ชื่อ
            <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs">LINE_VAULT_CHANNEL_ACCESS_TOKEN</code>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {status?.token ? <><CheckCircle2 className="h-4 w-4 text-green-600" /><span>ตั้งค่า Access Token แล้ว</span></> : <><XCircle className="h-4 w-4 text-destructive" /><span>ยังไม่ได้ตั้ง Access Token</span></>}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={checkStatus} disabled={checking}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${checking ? "animate-spin" : ""}`} />ตรวจสอบ
            </Button>
          </div>
          {status && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-muted"><div className="text-muted-foreground">กลุ่มที่เชื่อม</div><div className="text-lg font-semibold">{status.groups ?? "-"}</div></div>
              <div className="p-2 rounded bg-muted"><div className="text-muted-foreground">รายการในคลัง</div><div className="text-lg font-semibold">{status.items ?? "-"}</div></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />ตั้งค่า Channel Access Token (LINE Vault)</CardTitle>
          <p className="text-sm text-muted-foreground">
            วาง Access Token ของ <b>LINE OA ตัวใหม่</b> (คนละตัวกับแชทบอทของระบบ) ตรงนี้ได้เลย
            ระบบจะบันทึกลง secret ชื่อ{" "}
            <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs">LINE_VAULT_CHANNEL_ACCESS_TOKEN</code>
            ให้อัตโนมัติ ไม่ต้องเข้าหน้า Secrets แยก
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="text-xs">Channel Access Token</Label>
          <div className="flex gap-2">
            <Input
              type={showToken ? "text" : "password"}
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder={status?.token ? "•••••• (มีค่าที่ตั้งไว้แล้ว — วางค่าใหม่เพื่อแทนที่)" : "วาง Channel Access Token ที่นี่"}
              className="font-mono text-xs"
              autoComplete="off"
            />
            <Button variant="outline" size="icon" type="button" onClick={() => setShowToken((s) => !s)} title={showToken ? "ซ่อน" : "แสดง"}>
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button onClick={saveToken} disabled={savingToken || !tokenDraft.trim()}>
              <Save className="h-4 w-4 mr-1" />{savingToken ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            เก็บแบบเข้ารหัสในฐานข้อมูลของระบบ เฉพาะแอดมินเท่านั้นที่แก้ไขได้ • หลังบันทึกจะซิงก์ให้ webhook ใช้งานทันที
          </p>
        </CardContent>
      </Card>


      <Card>
        <CardHeader><CardTitle>Webhook URL (ตั้งใน LINE Developers ของ OA ตัวใหม่)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)}><Copy className="h-4 w-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground">คัดลอก URL นี้ไปวางในช่อง Webhook URL ของ Messaging API แล้วเปิด "Use webhook"</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ขั้นตอนติดตั้ง</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-2">
            <li>เข้า <a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">LINE Developers Console <ExternalLink className="h-3 w-3" /></a> → สร้าง Provider (ถ้ายังไม่มี) แล้วสร้าง <b>Messaging API channel ใหม่</b> (คนละตัวกับแชทบอทของระบบ)</li>
            <li>ในแท็บ <b>Messaging API</b> ของ channel ใหม่ → กด <b>Issue</b> Channel Access Token → คัดลอกค่าที่ได้</li>
            <li>นำ token มาตั้งเป็น secret ในระบบชื่อ <code className="px-1.5 py-0.5 rounded bg-muted text-xs">LINE_VAULT_CHANNEL_ACCESS_TOKEN</code> (หน้า Admin → Secrets)</li>
            <li>ใน channel เดิม → เปิด <b>Allow bot to join group chats</b> และปิด <b>Auto-reply</b>/<b>Greeting</b> (ไม่ต้องใช้)</li>
            <li>วาง Webhook URL ด้านบน → เปิดสวิตช์ <b>Use webhook</b></li>
            <li>เพิ่มเพื่อน OA ตัวใหม่แล้วเชิญเข้ากลุ่มที่ต้องการเก็บไฟล์</li>
            <li>กลับมาที่แท็บ <b>จัดการกลุ่ม</b> — กลุ่มจะโผล่ขึ้นอัตโนมัติ ตั้งชื่อและเปิด "จับอัตโนมัติ" เพื่อเริ่มเก็บ</li>
          </ol>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
            <b>หมายเหตุ:</b> LINE OA จะเห็นเฉพาะข้อความที่ส่ง<b>หลังจาก</b>ถูกเชิญเข้ากลุ่ม — ไฟล์เก่าก่อนหน้าดึงย้อนหลังไม่ได้
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** สำรองไฟล์เก่าที่อยู่บน Google Drive อย่างเดียว ให้มาเก็บใน Storage ของระบบด้วย */
function StorageBackfillCard({ onDone }: { onDone: () => void }) {
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");

  const extFor = (mime?: string | null, filename?: string | null) => {
    const fromName = filename?.includes(".") ? filename.split(".").pop() : null;
    if (fromName && fromName.length <= 5) return fromName.toLowerCase();
    const m = (mime || "").toLowerCase();
    if (m.includes("jpeg")) return "jpg";
    if (m.includes("png")) return "png";
    if (m.includes("gif")) return "gif";
    if (m.includes("mp4")) return "mp4";
    if (m.includes("pdf")) return "pdf";
    if (m.includes("m4a") || m.includes("aac")) return "m4a";
    return "bin";
  };

  const check = async () => {
    setBusy(true);
    try {
      const { count, error } = await supabase
        .from("line_vault_items")
        .select("id", { count: "exact", head: true })
        .is("storage_path", null)
        .not("drive_file_id", "is", null);
      if (error) throw error;
      setPending(count ?? 0);
    } catch (e: any) {
      toast.error(e?.message || "ตรวจสอบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const downloadFromDrive = async (fileId: string): Promise<Blob> => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    const res = await fetch(`${SUPABASE_RUNTIME_URL}/functions/v1/gdrive-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_RUNTIME_ANON_KEY,
        Authorization: `Bearer ${token ?? SUPABASE_RUNTIME_ANON_KEY}`,
      },
      body: JSON.stringify({ path: `/files/${fileId}`, method: "GET", query: { alt: "media", supportsAllDrives: true } }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 428 || text.includes("GOOGLE_DRIVE_NOT_CONNECTED") || text.includes("not_connected")) {
        const err: any = new Error(
          "ยังไม่ได้เชื่อม Google Drive — กรุณากด “เริ่มเชื่อม Google Drive” ในการ์ดด้านบน แล้วอนุญาตสิทธิ์ให้เรียบร้อยก่อน จึงค่อยกดสำรองไฟล์อีกครั้ง",
        );
        err.notConnected = true;
        throw err;
      }
      throw new Error(`Drive ${res.status}: ${text.slice(0, 160)}`);
    }
    return await res.blob();
  };


  const run = async () => {
    setBusy(true);
    setLog("");
    let total = 0;
    let failed = 0;
    try {
      for (let round = 0; round < 40; round++) {
        const { data: rows, error } = await supabase
          .from("line_vault_items")
          .select("id, drive_file_id, mime_type, original_filename, created_at")
          .is("storage_path", null)
          .not("drive_file_id", "is", null)
          .order("created_at", { ascending: true })
          .limit(10);
        if (error) throw error;
        if (!rows || rows.length === 0) break;

        for (const row of rows as any[]) {
          try {
            const blob = await downloadFromDrive(row.drive_file_id);
            const d = new Date(row.created_at);
            const ext = extFor(row.mime_type, row.original_filename);
            const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/backfill/${row.id}.${ext}`;
            const { error: upErr } = await supabase.storage.from("line-vault").upload(path, blob, {
              contentType: row.mime_type || blob.type || "application/octet-stream",
              upsert: true,
            });
            if (upErr) throw upErr;
            const { error: updErr } = await supabase
              .from("line_vault_items")
              .update({ storage_path: path })
              .eq("id", row.id);
            if (updErr) throw updErr;
            total++;
          } catch (e: any) {
            if (e?.notConnected) throw e;
            failed++;
            setLog(`สำรองแล้ว ${total} ไฟล์ · ล้มเหลว ${failed} — ${e?.message ?? ""}`);
            if (failed >= 3) throw e;
          }

          setLog(`สำรองแล้ว ${total} ไฟล์${failed ? ` · ล้มเหลว ${failed}` : ""}`);
        }
      }
      toast.success(`สำรองไฟล์เข้า Storage แล้ว ${total} รายการ`);
      onDone();
    } catch (e: any) {
      setLog(e?.message || "สำรองไฟล์ไม่สำเร็จ");
      toast.error(e?.message || "สำรองไฟล์ไม่สำเร็จ", e?.notConnected ? { duration: 8000 } : undefined);
    } finally {

      await check();
      setBusy(false);
    }
  };

  useEffect(() => { check(); /* eslint-disable-next-line */ }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Archive className="h-4 w-4" /> สำรองไฟล์เก่าจาก Google Drive เข้าระบบ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          ไฟล์เก่าบางส่วนถูกเก็บไว้บน Google Drive อย่างเดียว ทำให้เปิดดูไม่ได้เมื่อการเชื่อมต่อ Drive หลุด
          กดปุ่มด้านล่างเพื่อคัดลอกไฟล์เหล่านั้นมาเก็บในระบบให้ถาวร (ต้องเชื่อมต่อ Google Drive อยู่)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={pending ? "destructive" : "secondary"}>
            รอสำรอง {pending === null ? "…" : pending} ไฟล์
          </Badge>
          <Button size="sm" variant="outline" onClick={check} disabled={busy}>
            <RefreshCw className="h-4 w-4 mr-1" />ตรวจสอบอีกครั้ง
          </Button>
          <Button size="sm" onClick={run} disabled={busy || !pending}>
            <Download className="h-4 w-4 mr-1" />เริ่มสำรองไฟล์
          </Button>
        </div>
        {log && <p className="text-xs text-muted-foreground">{log}</p>}
      </CardContent>
    </Card>
  );
}
