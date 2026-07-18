import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Users, Megaphone, Trophy, Plus, Search, Crown, Star, ShieldCheck, Upload, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";

type Club = {
  id: string; name: string; code: string | null; description: string | null;
  category: string | null; cover_url: string | null; logo_url: string | null; is_special: boolean;
  special_kind: string | null; status: string; recruit_open: boolean;
  capacity: number | null; goals: string | null; location: string | null;
  meeting_day: string | null; meeting_period: string | null;
  academic_year: number | null; semester: number | null;
};

export default function ClubsHubPage() {
  const { role, userId } = useUserRole();
  const isAdmin = role === "admin" || role === "director";
  const [clubs, setClubs] = useState<Club[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "mine" | "recruit" | "special">("all");
  const [myClubIds, setMyClubIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", description: "", category: "ชุมนุมทั่วไป",
    location: "", meeting_day: "พุธ", meeting_period: "คาบ 7",
    capacity: 30, goals: "", recruit_open: true,
    cover_url: "", logo_url: "",
  });
  const [uploading, setUploading] = useState<"cover" | "logo" | null>(null);

  const uploadImage = async (file: File, kind: "cover" | "logo") => {
    if (!file.type.startsWith("image/")) return toast.error("กรุณาเลือกไฟล์รูปภาพ");
    if (file.size > 5 * 1024 * 1024) return toast.error("ไฟล์ต้องไม่เกิน 5MB");
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `clubs/${kind}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("cms-images").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("cms-images").getPublicUrl(path);
      setForm((f) => ({ ...f, [`${kind}_url`]: data.publicUrl }));
      toast.success(kind === "cover" ? "อัปโหลดภาพปกแล้ว" : "อัปโหลดโลโก้แล้ว");
    } catch (e: any) {
      toast.error(e.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(null);
    }
  };

  const load = async () => {
    const { data } = await supabase.from("clubs").select("*").order("is_special", { ascending: false }).order("name");
    setClubs((data || []) as Club[]);
    const ids = (data || []).map((c: any) => c.id);
    if (ids.length) {
      const { data: m } = await supabase.from("club_members").select("club_id, student_id").in("club_id", ids).eq("status", "active");
      const cnt: Record<string, number> = {};
      (m || []).forEach((r: any) => { cnt[r.club_id] = (cnt[r.club_id] || 0) + 1; });
      setCounts(cnt);
    }
    if (userId) {
      // student → find clubs where their student row is a member
      const { data: st } = await supabase.from("students").select("id").eq("auth_user_id", userId);
      const sids = (st || []).map((s: any) => s.id);
      if (sids.length) {
        const { data: mine } = await supabase.from("club_members").select("club_id").in("student_id", sids).eq("status", "active");
        setMyClubIds((mine || []).map((m: any) => m.club_id));
      }
      // teacher → advisor clubs
      const { data: adv } = await supabase.from("club_advisors").select("club_id").eq("teacher_id", userId);
      if (adv?.length) setMyClubIds((prev) => Array.from(new Set([...prev, ...adv.map((a: any) => a.club_id)])));
    }
  };

  useEffect(() => { load(); }, [userId]);

  useEffect(() => {
    const ch = supabase.channel("clubs-hub").on("postgres_changes", { event: "*", schema: "public", table: "clubs" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const filtered = useMemo(() => {
    let list = clubs;
    if (tab === "mine") list = list.filter((c) => myClubIds.includes(c.id));
    if (tab === "recruit") list = list.filter((c) => c.recruit_open && c.status === "open");
    if (tab === "special") list = list.filter((c) => c.is_special);
    if (q.trim()) {
      const k = q.toLowerCase();
      list = list.filter((c) => [c.name, c.code, c.description, c.category].some((x) => (x || "").toLowerCase().includes(k)));
    }
    return list;
  }, [clubs, tab, q, myClubIds]);

  const createClub = async () => {
    if (!form.name.trim()) return toast.error("กรุณากรอกชื่อชุมนุม");
    const { error } = await supabase.from("clubs").insert({
      ...form, status: "open", is_special: false, created_by: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("สร้างชุมนุมสำเร็จ");
    setOpen(false);
    setForm({ ...form, name: "", code: "", description: "", cover_url: "", logo_url: "" });
    load();
  };

  const tbno = clubs.find((c) => c.special_kind === "tobenumberone");

  return (
    <div className="space-y-6">
      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl gradient-primary"><Sparkles className="w-7 h-7 text-white" /></div>
              <div>
                <CardTitle className="text-2xl">ฮับชุมนุม</CardTitle>
                <CardDescription>ศูนย์รวมทุกชุมนุม/ชมรม สมาชิก ประธาน ครูที่ปรึกษา การเช็คชื่อ ผลงาน และการรับสมัคร</CardDescription>
              </div>
            </div>
            {isAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="w-4 h-4" /> สร้างชุมนุม</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>สร้างชุมนุมใหม่</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>ชื่อชุมนุม *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>รหัส</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
                      <div><Label>หมวด</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                    </div>
                    <div><Label>คำอธิบาย</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label>วัน</Label><Input value={form.meeting_day} onChange={(e) => setForm({ ...form, meeting_day: e.target.value })} /></div>
                      <div><Label>คาบ</Label><Input value={form.meeting_period} onChange={(e) => setForm({ ...form, meeting_period: e.target.value })} /></div>
                      <div><Label>รับได้</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: +e.target.value })} /></div>
                    </div>
                    <div><Label>สถานที่</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                    <div><Label>เป้าหมาย/วัตถุประสงค์</Label><Textarea rows={2} value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <Label>ภาพปก</Label>
                        <div className="mt-1 relative aspect-video rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden">
                          {form.cover_url ? (
                            <>
                              <img src={form.cover_url} alt="cover" className="w-full h-full object-cover" />
                              <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6" onClick={() => setForm({ ...form, cover_url: "" })}><X className="w-3 h-3" /></Button>
                            </>
                          ) : (
                            <label className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/50 transition">
                              {uploading === "cover" ? <span className="text-xs">กำลังอัปโหลด...</span> : <><Upload className="w-5 h-5" /><span className="text-xs">เลือกภาพปก</span></>}
                              <input type="file" accept="image/*" className="hidden" disabled={uploading !== null} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "cover")} />
                            </label>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>โลโก้ชุมนุม</Label>
                        <div className="mt-1 relative aspect-square rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden max-w-[140px]">
                          {form.logo_url ? (
                            <>
                              <img src={form.logo_url} alt="logo" className="w-full h-full object-cover" />
                              <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6" onClick={() => setForm({ ...form, logo_url: "" })}><X className="w-3 h-3" /></Button>
                            </>
                          ) : (
                            <label className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/50 transition">
                              {uploading === "logo" ? <span className="text-xs">อัปโหลด...</span> : <><ImageIcon className="w-5 h-5" /><span className="text-xs">โลโก้</span></>}
                              <input type="file" accept="image/*" className="hidden" disabled={uploading !== null} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "logo")} />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between"><Label>เปิดรับสมัคร</Label><Switch checked={form.recruit_open} onCheckedChange={(v) => setForm({ ...form, recruit_open: v })} /></div>
                  </div>
                  <DialogFooter><Button onClick={createClub}>บันทึก</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
      </Card>


      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="ค้นหาชุมนุม..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            <TabsTrigger value="mine">ของฉัน</TabsTrigger>
            <TabsTrigger value="recruit">เปิดรับสมัคร</TabsTrigger>
            <TabsTrigger value="special">ชมรมพิเศษ</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <Link key={c.id} to={`/dashboard/clubs/${c.id}`}>
            <Card className="hover-lift h-full overflow-hidden">
              {c.cover_url && (
                <div className="h-24 w-full overflow-hidden bg-muted">
                  <img src={c.cover_url} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0 ${c.logo_url ? "bg-muted" : c.is_special ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {c.logo_url ? (
                        <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : c.is_special ? <Crown className="w-5 h-5" /> : <Trophy className="w-5 h-5 text-warning" />}
                    </div>
                    <div>
                      <h3 className="font-semibold leading-tight">{c.name}</h3>
                      <p className="text-xs text-muted-foreground">{c.category || "ชุมนุม"} {c.code && `· ${c.code}`}</p>
                    </div>
                  </div>
                  {c.recruit_open && <Badge variant="outline" className="text-xs">รับสมัคร</Badge>}
                </div>
                {c.description && <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {counts[c.id] || 0}/{c.capacity || "-"}</span>
                  {c.meeting_day && <span>📅 {c.meeting_day} {c.meeting_period}</span>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <Card className="col-span-full"><CardContent className="p-10 text-center text-muted-foreground">ยังไม่มีข้อมูล</CardContent></Card>
        )}
      </div>

      {isAdmin && (
        <Card className="border-info/30 bg-info/5">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-info mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">มุมมองผู้บริหาร</p>
              <p className="text-muted-foreground">คุณดูได้ทุกชุมนุม แก้ไขรายละเอียด ตั้ง/ปลดครูประจำชุมนุม และดูสรุปการเช็คชื่อ/ผลงาน/รับสมัครของแต่ละชุมนุม</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
