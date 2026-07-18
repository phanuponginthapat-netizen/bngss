import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trophy, Plus, Calendar, MapPin, Loader2, Upload, X, Megaphone, Search, Award, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateBE as formatDate } from "@/lib/dateBE";
import { compressImage } from "@/lib/imageCompress";
import { notify } from "@/lib/notify";
import { ACTIVITY_TEMPLATES, getTemplate } from "@/lib/activityTemplates";
import { DateTimeInput } from "@/components/ui/datetime-input";

type Activity = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  location: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string;
  cover_image_url: string | null;
  max_score: number | null;
  scoring_mode: string;
  level: string | null;
  supervisor_teachers: string | null;
  result_summary: string | null;
  report_summary: string | null;
  gallery_images: string[] | null;
  budget: number | null;
  certificate_url: string | null;
  live_stream_url: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  academic: "วิชาการ", sport: "กีฬา", music: "ดนตรี", art: "ศิลปะ", computer: "คอมพิวเตอร์", other: "อื่นๆ",
};
const CATEGORY_COLOR: Record<string, string> = {
  academic: "bg-info/15 text-info",
  sport: "bg-success/15 text-success",
  music: "bg-danger/15 text-danger",
  art: "bg-warning/15 text-warning",
  computer: "bg-info/15 text-info",
  other: "bg-muted text-muted-foreground",
};
const LEVEL_LABEL: Record<string, string> = {
  school: "โรงเรียน",
  sub_district: "กลุ่มโรงเรียน/ตำบล",
  district: "เขต/อำเภอ",
  province: "จังหวัด",
  region: "ภาค",
  national: "ประเทศ",
  international: "นานาชาติ",
};
const STATUS_LABEL: Record<string, { th: string; color: string }> = {
  draft: { th: "ร่าง", color: "bg-muted text-muted-foreground" },
  open: { th: "เปิดรับสมัคร", color: "bg-info/15 text-info" },
  ongoing: { th: "กำลังแข่ง", color: "bg-warning/15 text-warning" },
  finished: { th: "เสร็จสิ้น", color: "bg-success/15 text-success" },
};

export default function ActivitiesPage() {
  const { isAdmin, isDirector, isTeacher, isAlumni } = useUserRole();
  const canManage = isAdmin || isDirector || isTeacher;
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (a: Activity) => { setEditing(a); setDialogOpen(true); };

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("activities").select("*").order("start_at", { ascending: false, nullsFirst: false });
    if (error) toast.error(error.message);
    setItems((data as Activity[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel("activities-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  const statsByCat = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((a) => { map[a.category] = (map[a.category] || 0) + 1; });
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      if (isAlumni && !(a as any).allow_alumni) return false;
      if (catFilter !== "all" && a.category !== catFilter) return false;
      if (levelFilter !== "all" && (a.level || "") !== levelFilter) return false;
      if (q && !a.title.toLowerCase().includes(q) && !(a.description || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, catFilter, levelFilter, isAlumni]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl gradient-primary">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">กิจกรรม & การแข่งขัน</CardTitle>
                <CardDescription>สร้างกิจกรรม ลงทะเบียนนักเรียน บันทึกคะแนน และโพสผลขึ้นฟีดอัตโนมัติ</CardDescription>
              </div>
            </div>
            {canManage && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="w-4 h-4" /> สร้างกิจกรรม
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Stats by category */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Object.keys(CATEGORY_LABEL).map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(catFilter === cat ? "all" : cat)}
            className={`text-left p-3 rounded-xl border transition-all hover:shadow-md ${
              catFilter === cat ? "ring-2 ring-primary border-primary" : "border-border"
            }`}
          >
            <div className="text-xs text-muted-foreground">{CATEGORY_LABEL[cat]}</div>
            <div className="text-2xl font-bold">{statsByCat[cat] || 0}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อกิจกรรม..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="ประเภท" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกประเภท</SelectItem>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="ระดับ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกระดับ</SelectItem>
              {Object.entries(LEVEL_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(catFilter !== "all" || levelFilter !== "all" || search) && (
            <Button variant="ghost" size="sm" onClick={() => { setCatFilter("all"); setLevelFilter("all"); setSearch(""); }}>
              ล้างตัวกรอง
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {items.length === 0 ? "ยังไม่มีกิจกรรม" : "ไม่พบกิจกรรมที่ตรงกับตัวกรอง"}
        </CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => {
            const st = STATUS_LABEL[a.status] || STATUS_LABEL.draft;
            const gallery = Array.isArray(a.gallery_images) ? a.gallery_images : [];
            const preview = a.cover_image_url || gallery[0] || null;
            return (
              <div key={a.id} className="relative">
                <Link to={`/dashboard/activities/${a.id}`}>
                  <Card className="h-full hover:shadow-elevated transition-shadow overflow-hidden">
                    {preview ? (
                      <div className="aspect-video bg-muted overflow-hidden relative">
                        <img src={preview} alt={a.title} className="w-full h-full object-cover" />
                        {gallery.length > 0 && (
                          <Badge className="absolute bottom-2 right-2 bg-black/60 text-white border-0 gap-1">
                            <ImageBadge count={gallery.length} />
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted/40 flex items-center justify-center text-muted-foreground text-xs">
                        ไม่มีรูปภาพ
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-2">{a.title}</CardTitle>
                        <Badge className={st.color}>{st.th}</Badge>
                      </div>
                      <CardDescription className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="outline" className={CATEGORY_COLOR[a.category] || ""}>
                          {CATEGORY_LABEL[a.category] || a.category}
                        </Badge>
                        {a.level && <Badge variant="outline">ระดับ{LEVEL_LABEL[a.level] || a.level}</Badge>}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      {a.description && <p className="line-clamp-2">{a.description}</p>}
                      {a.start_at && (
                        <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(a.start_at)}</div>
                      )}
                      {a.location && (
                        <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {a.location}</div>
                      )}
                      {a.supervisor_teachers && (
                        <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {a.supervisor_teachers}</div>
                      )}
                      {a.result_summary && (
                        <div className="flex items-center gap-1.5 text-warning"><Award className="w-3.5 h-3.5" /> {a.result_summary}</div>
                      )}
                      {canManage && (
                        <div className="pt-2">
                          <AnnounceButton activity={a} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
                {canManage && (
                  <Button
                    type="button" size="icon" variant="secondary"
                    className="absolute top-2 right-2 h-8 w-8 shadow-md z-10"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(a); }}
                    title="แก้ไขกิจกรรม"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManage && (
        <ActivityFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} existing={editing} />
      )}
    </div>
  );
}

function ImageBadge({ count }: { count: number }) {
  return <span className="text-xs">📷 {count}</span>;
}

export function ActivityFormDialog({ open, onOpenChange, onSaved, existing, defaultSportsDayMeetId, defaultCategory }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; existing?: Activity | null;
  defaultSportsDayMeetId?: string; defaultCategory?: string;
}) {
  const isEdit = !!existing;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [form, setForm] = useState({
    template_id: "",
    title: "", category: "academic", description: "", rules: "", location: "",
    start_at: "", end_at: "", status: "draft",
    cover_image_url: "",
    registration_open: false,
    allow_alumni: false,
    registration_deadline: "",
    max_participants: "",
    format: "free",
    level: "school",
    supervisor_teachers: "",
    participant_names: "",
    result_summary: "",
    report_summary: "",
    budget: "",
    certificate_url: "",
    live_stream_url: "",
    gallery_images: [] as string[],
    sports_day_meet_id: "",
  });

  const [sportsDayMeets, setSportsDayMeets] = useState<any[]>([]);
  useEffect(() => {
    if (!open) return;
    (supabase as any).from("sports_day_meets").select("id, title").order("start_date", { ascending: false })
      .then(({ data }: any) => setSportsDayMeets(data || []));
  }, [open]);

  const reset = () => setForm({
    template_id: "",
    title: "", category: "academic", description: "", rules: "", location: "",
    start_at: "", end_at: "", status: "draft", cover_image_url: "",
    registration_open: false, allow_alumni: false, registration_deadline: "", max_participants: "", format: "free",
    level: "school", supervisor_teachers: "", participant_names: "",
    result_summary: "", report_summary: "", budget: "", certificate_url: "", live_stream_url: "",
    gallery_images: [],
    sports_day_meet_id: "",
  });

  // Populate from existing when dialog opens for editing
  useEffect(() => {
    if (!open) return;
    if (existing) {
      const toLocal = (iso: string | null | undefined) => {
        if (!iso) return "";
        const d = new Date(iso);
        const tzOff = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOff).toISOString().slice(0, 16);
      };
      setForm({
        template_id: (existing as any).template_id || "",
        title: existing.title || "",
        category: existing.category || "academic",
        description: existing.description || "",
        rules: (existing as any).rules || "",
        location: existing.location || "",
        start_at: toLocal(existing.start_at),
        end_at: toLocal(existing.end_at),
        status: existing.status || "draft",
        cover_image_url: existing.cover_image_url || "",
        registration_open: !!(existing as any).registration_open,
        allow_alumni: !!(existing as any).allow_alumni,
        registration_deadline: toLocal((existing as any).registration_deadline),
        max_participants: (existing as any).max_participants ? String((existing as any).max_participants) : "",
        format: (existing as any).format || "free",
        level: existing.level || "school",
        supervisor_teachers: existing.supervisor_teachers || "",
        participant_names: (existing as any).participant_names || "",
        result_summary: existing.result_summary || "",
        report_summary: existing.report_summary || "",
        budget: (existing as any).budget != null ? String((existing as any).budget) : "",
        certificate_url: existing.certificate_url || "",
        live_stream_url: existing.live_stream_url || "",
        gallery_images: Array.isArray(existing.gallery_images) ? existing.gallery_images : [],
        sports_day_meet_id: (existing as any).sports_day_meet_id || "",
      });
    } else {
      reset();
      if (defaultSportsDayMeetId || defaultCategory) {
        setForm((f) => ({
          ...f,
          sports_day_meet_id: defaultSportsDayMeetId || "",
          category: defaultCategory || f.category,
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing, defaultSportsDayMeetId, defaultCategory]);

  const applyTemplate = (tid: string) => {
    const t = getTemplate(tid);
    if (!t) { setForm((f) => ({ ...f, template_id: tid })); return; }
    setForm((f) => ({
      ...f,
      template_id: tid,
      category: t.category,
      rules: f.rules?.trim() ? f.rules : t.defaultRules,
      title: f.title?.trim() ? f.title : t.label,
      format: t.bracketSupported ? "single_elim" : "free",
      max_participants: t.suggestedMax ? String(t.suggestedMax) : f.max_participants,
    }));
  };

  const uploadOne = async (file: File, subdir: string) => {
    const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, maxSizeKB: 300 });
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${user?.id}/activities/${subdir}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${compressed.name}`;
    const { error: upErr } = await supabase.storage.from("wall-media").upload(path, compressed, {
      contentType: compressed.type, upsert: true,
    });
    if (upErr) throw upErr;
    const { data } = await supabase.storage.from("wall-media").createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl || "";
  };

  const onPickCover = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadOne(file, "covers");
      setForm((f) => ({ ...f, cover_image_url: url }));
    } catch (e: any) {
      toast.error(e.message || "อัพโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const onPickGallery = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).slice(0, 6 - form.gallery_images.length);
    if (arr.length === 0) return toast.error("แกลเลอรีรับสูงสุด 6 รูป");
    setGalleryUploading(true);
    try {
      const urls: string[] = [];
      for (const f of arr) {
        urls.push(await uploadOne(f, "gallery"));
      }
      setForm((f) => ({ ...f, gallery_images: [...f.gallery_images, ...urls] }));
    } catch (e: any) {
      toast.error(e.message || "อัพโหลดรูปไม่สำเร็จ");
    } finally {
      setGalleryUploading(false);
    }
  };

  const removeGalleryAt = (idx: number) => {
    setForm((f) => ({ ...f, gallery_images: f.gallery_images.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("กรุณาระบุชื่อกิจกรรม");
    if (form.gallery_images.length > 0 && form.gallery_images.length < 4) {
      return toast.error("กรุณาแนบรูปภาพในแกลเลอรีอย่างน้อย 4 รูป (หรือไม่แนบเลย)");
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      title: form.title,
      category: form.category,
      status: form.status,
      start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      cover_image_url: form.cover_image_url || null,
      description: form.description || null,
      rules: form.rules || null,
      location: form.location || null,
      template_id: form.template_id || null,
      registration_open: form.registration_open,
      allow_alumni: form.allow_alumni,
      registration_deadline: form.registration_deadline ? new Date(form.registration_deadline).toISOString() : null,
      max_participants: form.max_participants ? Number(form.max_participants) : null,
      format: form.format,
      level: form.level || null,
      supervisor_teachers: form.supervisor_teachers || null,
      participant_names: form.participant_names || null,
      result_summary: form.result_summary || null,
      report_summary: form.report_summary || null,
      budget: form.budget ? Number(form.budget) : null,
      certificate_url: form.certificate_url || null,
      live_stream_url: form.live_stream_url || null,
      gallery_images: form.gallery_images,
      sports_day_meet_id: form.sports_day_meet_id || null,
    };
    if (!isEdit) payload.created_by = user?.id;
    const q = isEdit
      ? (supabase as any).from("activities").update(payload).eq("id", existing!.id)
      : (supabase as any).from("activities").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "บันทึกการแก้ไขแล้ว" : "สร้างกิจกรรมแล้ว");
    if (!isEdit) reset();
    onOpenChange(false); onSaved();
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirm(`ลบกิจกรรม "${existing.title}" ?\n(ข้อมูลผู้เข้าร่วม คะแนน และผลทั้งหมดจะถูกลบด้วย)`)) return;
    setSaving(true);
    const { error } = await (supabase as any).from("activities").delete().eq("id", existing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("ลบกิจกรรมแล้ว");
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "แก้ไขกิจกรรม" : "สร้างกิจกรรม / บันทึกการแข่งขัน"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>เทมเพลตประเภทกิจกรรม</Label>
            <Select value={form.template_id || "_none"} onValueChange={(v) => applyTemplate(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="เลือกเทมเพลต (ระบบจะเติมกติกาเริ่มต้นให้)" /></SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="_none">— ไม่ใช้เทมเพลต —</SelectItem>
                {(["sport","academic","art","computer","other"] as const).map((cat) => (
                  <div key={cat}>
                    <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground tracking-wider">
                      {CATEGORY_LABEL[cat]}
                    </div>
                    {ACTIVITY_TEMPLATES.filter((t) => t.category === cat).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>ชื่อกิจกรรม *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label>ประเภท</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ระดับการแข่งขัน</Label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEVEL_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>สถานะ</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">ร่าง</SelectItem>
                  <SelectItem value="open">เปิดรับสมัคร</SelectItem>
                  <SelectItem value="ongoing">กำลังแข่ง</SelectItem>
                  <SelectItem value="finished">เสร็จสิ้น</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>รายละเอียด</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>วันที่เริ่ม</Label>
              <DateTimeInput value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
            </div>
            <div>
              <Label>วันที่สิ้นสุด</Label>
              <DateTimeInput value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>สถานที่การแข่งขัน</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="เช่น สนามฟุตบอลโรงเรียน, ห้องประชุม 1, อาคาร 3 ชั้น 2" />
          </div>
          <div>
            <Label>งานกีฬาสี (ถ้าเป็นรายการในงานกีฬาสี)</Label>
            <Select value={form.sports_day_meet_id || "none"} onValueChange={(v) => setForm({ ...form, sports_day_meet_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="ไม่ผูกกับงานกีฬาสี" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ไม่ผูกกับงานกีฬาสี —</SelectItem>
                {sportsDayMeets.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>ครูผู้ดูแล / ผู้ฝึกสอน</Label>
            <Input value={form.supervisor_teachers}
              onChange={(e) => setForm({ ...form, supervisor_teachers: e.target.value })}
              placeholder="เช่น ครูสมชาย, ครูสมหญิง" />
          </div>
          <div>
            <Label>รายชื่อนักเรียนที่เข้าร่วม</Label>
            <Textarea value={form.participant_names}
              onChange={(e) => setForm({ ...form, participant_names: e.target.value })}
              rows={2}
              placeholder="ระบุชื่อนักเรียน 1 คน/บรรทัด (หรือเพิ่มผ่านรายการผู้เข้าร่วมในหน้ารายละเอียดภายหลัง)" />
          </div>
          <div>
            <Label>ผลการแข่งขัน</Label>
            <Input value={form.result_summary}
              onChange={(e) => setForm({ ...form, result_summary: e.target.value })}
              placeholder="เช่น รางวัลชนะเลิศ, เหรียญทอง, อันดับ 2" />
          </div>
          <div>
            <Label>สรุปรายงานกิจกรรม</Label>
            <Textarea value={form.report_summary}
              onChange={(e) => setForm({ ...form, report_summary: e.target.value })}
              rows={4}
              placeholder="สรุปผลการดำเนินงาน บรรยากาศ ปัญหา ข้อเสนอแนะ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>งบประมาณ (บาท)</Label>
              <Input type="number" min={0} step="0.01" value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            </div>
            <div>
              <Label>ลิงก์เกียรติบัตร (URL)</Label>
              <Input value={form.certificate_url}
                onChange={(e) => setForm({ ...form, certificate_url: e.target.value })}
                placeholder="https://..." />
            </div>
          </div>
          <div>
            <Label>🔴 ลิงก์ถ่ายทอดสด (YouTube / Facebook / TikTok / Twitch)</Label>
            <Input value={form.live_stream_url}
              onChange={(e) => setForm({ ...form, live_stream_url: e.target.value })}
              placeholder="วางลิงก์ที่นี่ ระบบจะแสดงเป็นวีดีโอให้รับชมในระบบทันที" />
            <p className="text-[11px] text-muted-foreground mt-1">
              รองรับ: youtube.com/watch, youtu.be, youtube.com/live, facebook.com/.../videos, fb.watch, tiktok.com/@user/video/..., twitch.tv/channel
            </p>
          </div>
          <div>
            <Label>กฎ/กติกาการแข่งขัน และเกณฑ์การให้คะแนน</Label>
            <Textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>รูปแบบการแข่ง</Label>
              <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">อิสระ/ตามกติกา</SelectItem>
                  <SelectItem value="single_elim">แพ้คัดออก (Bracket)</SelectItem>
                  <SelectItem value="round_robin">พบกันหมด</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>จำนวนผู้สมัครสูงสุด</Label>
              <Input type="number" min={0} value={form.max_participants}
                onChange={(e) => setForm({ ...form, max_participants: e.target.value })}
                placeholder="ไม่จำกัด" />
            </div>
          </div>
          <div className="rounded-md border p-3 space-y-2 bg-muted/30">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={form.registration_open}
                onChange={(e) => setForm({ ...form, registration_open: e.target.checked })} />
              เปิดให้เด็กลงทะเบียนเองผ่าน QR ทันที
            </label>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={form.allow_alumni}
                onChange={(e) => setForm({ ...form, allow_alumni: e.target.checked })} />
              เปิดให้ศิษย์เก่าเข้าร่วม/มองเห็นกิจกรรมนี้
            </label>
            <div>
              <Label className="text-xs">ปิดรับสมัครภายใน (ไม่บังคับ)</Label>
              <DateTimeInput value={form.registration_deadline}
                onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>รูปปก (ไม่บังคับ)</Label>
            {form.cover_image_url ? (
              <div className="relative mt-1">
                <img src={form.cover_image_url} alt="cover" className="w-full aspect-video object-cover rounded-md border" />
                <Button type="button" size="icon" variant="secondary"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => setForm({ ...form, cover_image_url: "" })}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <label className="mt-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-md py-6 cursor-pointer hover:bg-muted/40 text-sm text-muted-foreground">
                {uploading ? <><Loader2 className="w-5 h-5 animate-spin" /> กำลังอัพโหลด...</>
                  : <><Upload className="w-5 h-5" /> คลิกเพื่ออัพโหลดรูปปก</>}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => { onPickCover(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
          </div>
          <div>
            <Label>
              แกลเลอรีรูปภาพ ({form.gallery_images.length}/6) <span className="text-xs text-muted-foreground">— ถ้าแนบ ต้องอย่างน้อย 4 รูป</span>
            </Label>
            {form.gallery_images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                {form.gallery_images.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-md overflow-hidden border">
                    <img src={url} alt={`gallery-${idx}`} className="w-full h-full object-cover" />
                    <Button type="button" size="icon" variant="secondary"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => removeGalleryAt(idx)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {form.gallery_images.length < 6 && (
              <label className="mt-2 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-md py-4 cursor-pointer hover:bg-muted/40 text-sm text-muted-foreground">
                {galleryUploading ? <><Loader2 className="w-5 h-5 animate-spin" /> กำลังอัพโหลด...</>
                  : <><Upload className="w-5 h-5" /> เพิ่มรูป (เลือกหลายไฟล์พร้อมกันได้)</>}
                <input type="file" accept="image/*" multiple className="hidden" disabled={galleryUploading}
                  onChange={(e) => { onPickGallery(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {isEdit ? (
            <Button variant="destructive" onClick={remove} disabled={saving} className="gap-2">
              <Trash2 className="w-4 h-4" /> ลบกิจกรรม
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {isEdit ? "บันทึกการแก้ไข" : "บันทึก"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnnounceButton({ activity }: { activity: Activity }) {
  const [busy, setBusy] = useState(false);
  const announce = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const title = `📣 ประกาศกิจกรรม: ${activity.title}`;
      const body = [
        activity.description || "",
        activity.start_at ? `🗓 ${formatDate(activity.start_at)}` : "",
        activity.location ? `📍 ${activity.location}` : "",
      ].filter(Boolean).join("\n");

      const { data: inserted, error } = await supabase.from("news_posts").insert({
        title,
        content: body,
        category: "activity",
        author_id: user?.id,
        is_published: true,
        published_at: new Date().toISOString(),
      } as any).select("id").single();
      if (error) throw error;

      const { data: roleRows } = await supabase.from("user_roles").select("user_id");
      const ids = [...new Set((roleRows ?? []).map((r: any) => r.user_id).filter(Boolean))];
      if (ids.length) {
        await notify({
          user_ids: ids,
          title,
          body: body.slice(0, 200),
          type: "activity_announcement",
          severity: "info",
          reference_id: activity.id,
          reference_type: "activities",
          url: `/dashboard/activities/${activity.id}`,
          channels: ["in_app", "push", "line"],
          dedup_key: `activity-announce-${activity.id}-${inserted?.id}`,
        });
      }
      toast.success(`ประกาศแล้ว แจ้งเตือน ${ids.length} คน`);
    } catch (err: any) {
      toast.error(err.message || "ประกาศไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="secondary" className="w-full gap-2" onClick={announce} disabled={busy}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Megaphone className="w-3.5 h-3.5" />}
      ประกาศกิจกรรมนี้
    </Button>
  );
}
