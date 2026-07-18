import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PhotoUploadField } from "@/components/ui/photo-upload-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Crown, Users, Trophy, Megaphone, UserPlus, Sparkles, Plus, Check, X, Star, Pencil, QrCode, Image as ImageIcon, Trash2, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

const POSITIONS = [
  { v: "president", l: "ประธาน" },
  { v: "vice", l: "รองประธาน" },
  { v: "secretary", l: "เลขานุการ" },
  { v: "treasurer", l: "เหรัญญิก" },
  { v: "committee", l: "กรรมการ" },
  { v: "member", l: "สมาชิก" },
];

export default function ClubDetailPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const { role, userId } = useUserRole();
  const isAdmin = role === "admin" || role === "director";
  const [club, setClub] = useState<any>(null);
  const [advisors, setAdvisors] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [works, setWorks] = useState<any[]>([]);
  const [anns, setAnns] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [myStudentId, setMyStudentId] = useState<string | null>(null);
  const [isAdvisor, setIsAdvisor] = useState(false);
  const [isOfficer, setIsOfficer] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const canManage = isAdmin || isAdvisor || isOfficer;
  const canPostFeed = canManage || activeMemberCheck();

  function activeMemberCheck() {
    return members.some((m) => m.status === "active" && m.student_id === myStudentId);
  }

  const load = async () => {
    if (!id) return;
    const [{ data: c }, { data: ad }, { data: m }, { data: ap }, { data: w }, { data: an }, { data: fp }] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", id).maybeSingle(),
      supabase.from("club_advisors").select("*, profiles:teacher_id(first_name,last_name,nickname,position_title,avatar_url)").eq("club_id", id),
      supabase.from("club_members").select("*, students:student_id(first_name,last_name,prefix,student_code,classroom_id)").eq("club_id", id).order("position"),
      supabase.from("club_applications").select("*, students:student_id(first_name,last_name,prefix,student_code)").eq("club_id", id).order("created_at", { ascending: false }),
      supabase.from("club_works").select("*").eq("club_id", id).order("work_date", { ascending: false }),
      supabase.from("club_announcements").select("*").eq("club_id", id).order("pinned", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("club_feed_posts").select("*, profiles:author_id(first_name,last_name,nickname,avatar_url)").eq("club_id", id).order("created_at", { ascending: false }),
    ]);
    setClub(c); setAdvisors(ad || []); setMembers(m || []); setApps(ap || []); setWorks(w || []); setAnns(an || []); setFeed(fp || []);
    if (userId) {
      setIsAdvisor((ad || []).some((x: any) => x.teacher_id === userId));
      const { data: st } = await supabase.from("students").select("id").eq("auth_user_id", userId).maybeSingle();
      setMyStudentId(st?.id || null);
      setIsOfficer((m || []).some((x: any) => x.student_id === st?.id && ["president", "vice", "secretary", "committee"].includes(x.position)));
    }
  };

  useEffect(() => { load(); }, [id, userId]);

  // load attendance for date
  useEffect(() => {
    if (!id) return;
    supabase.from("club_attendance").select("*").eq("club_id", id).eq("session_date", sessionDate).then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.student_id] = r.status; });
      setAttendance(map);
    });
  }, [id, sessionDate]);

  const setAtt = async (studentId: string, status: string) => {
    setAttendance((p) => ({ ...p, [studentId]: status }));
    await supabase.from("club_attendance").upsert({
      club_id: id, student_id: studentId, session_date: sessionDate, status, recorded_by: userId,
    }, { onConflict: "club_id,student_id,session_date" });
  };

  const apply = async () => {
    if (!myStudentId) return toast.error("ไม่พบข้อมูลนักเรียนของคุณ");
    const { error } = await supabase.from("club_applications").insert({ club_id: id, student_id: myStudentId, status: "pending" });
    if (error) {
      if (error.code === "23505") return toast.info("คุณส่งใบสมัครชุมนุมนี้แล้ว");
      return toast.error(error.message);
    }
    toast.success("ส่งใบสมัครแล้ว รอครูประจำชุมนุมอนุมัติ");
    load();
  };

  // Auto-apply via QR (?join=1)
  useEffect(() => {
    if (search.get("join") === "1" && role === "student" && myStudentId && club && !apps.some((a) => a.student_id === myStudentId)) {
      apply();
    }
  }, [search, role, myStudentId, club]);

  const approveApp = async (a: any) => {
    await supabase.from("club_applications").update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", a.id);
    await supabase.from("club_members").upsert({ club_id: id, student_id: a.student_id, position: "member", status: "active" }, { onConflict: "club_id,student_id" });
    toast.success("อนุมัติแล้ว"); load();
  };
  const rejectApp = async (a: any) => {
    await supabase.from("club_applications").update({ status: "rejected", reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", a.id);
    toast.success("ปฏิเสธแล้ว"); load();
  };

  const changePosition = async (memberId: string, position: string) => {
    await supabase.from("club_members").update({ position }).eq("id", memberId);
    toast.success("บันทึกแล้ว"); load();
  };

  const removeMember = async (memberId: string) => {
    await supabase.from("club_members").update({ status: "left" }).eq("id", memberId);
    load();
  };

  const stats = useMemo(() => {
    const present = Object.values(attendance).filter((s) => s === "present").length;
    const absent = Object.values(attendance).filter((s) => s === "absent").length;
    const late = Object.values(attendance).filter((s) => s === "late").length;
    const total = members.filter((m) => m.status === "active").length;
    return { present, absent, late, total, pct: total ? Math.round((present / total) * 100) : 0 };
  }, [attendance, members]);

  if (!club) return <div className="p-10 text-center text-muted-foreground">กำลังโหลด...</div>;

  const activeMembers = members.filter((m) => m.status === "active");
  const president = activeMembers.find((m) => m.position === "president");

  const hasApplied = apps.some((a) => a.student_id === myStudentId && a.status === "pending");
  const isMember = activeMembers.some((m) => m.student_id === myStudentId);

  const joinUrl = `${window.location.origin}/dashboard/clubs/${id}?join=1`;

  return (
    <div className="space-y-4">
      <Card className={`border-2 overflow-hidden ${club.is_special ? "border-primary/50 bg-gradient-to-br from-primary/10 via-background to-warning/10" : ""}`}>
        {club.cover_url && (
          <div className="h-32 sm:h-48 w-full overflow-hidden bg-muted">
            <img src={club.cover_url} alt={club.name} className="w-full h-full object-cover" />
          </div>
        )}
        <CardHeader className={club.cover_url ? "-mt-12 sm:-mt-16" : ""}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3">
              <div className={`relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ring-4 ring-background overflow-hidden flex items-center justify-center ${club.is_special ? "bg-gradient-to-br from-primary to-warning text-primary-foreground" : "bg-muted"}`}>
                {club.logo_url ? (
                  <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
                ) : club.is_special ? (
                  <Crown className="w-10 h-10" />
                ) : (
                  <Trophy className="w-10 h-10 text-warning" />
                )}
              </div>
              <div className={club.cover_url ? "pt-12 sm:pt-14" : ""}>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-2xl">{club.name}</CardTitle>
                  {club.is_special && <Badge className="gap-1"><Star className="w-3 h-3" /> ชมรมพิเศษ</Badge>}
                  {club.recruit_open && <Badge className="bg-success text-success-foreground">เปิดรับสมัคร</Badge>}
                </div>
                <CardDescription className="mt-1">{club.description}</CardDescription>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                  {club.category && <span>หมวด: {club.category}</span>}
                  {club.meeting_day && <span>📅 {club.meeting_day} {club.meeting_period}</span>}
                  {club.location && <span>📍 {club.location}</span>}
                  <span>👥 สมาชิก {activeMembers.length}/{club.capacity || "-"}</span>
                  {president && <span>👑 ประธาน: {president.students?.prefix}{president.students?.first_name} {president.students?.last_name}</span>}
                </div>
              </div>
            </div>
            <div className={`flex gap-2 flex-wrap ${club.cover_url ? "pt-12 sm:pt-14" : ""}`}>
              {canManage && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setQrOpen(true)}>
                  <QrCode className="w-4 h-4" /> QR สมัคร
                </Button>
              )}
              {(isAdmin || isAdvisor) && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditOpen(true)}>
                  <Pencil className="w-4 h-4" /> แก้ไข
                </Button>
              )}
              {role === "student" && !isMember && club.recruit_open && (
                <Button onClick={apply} disabled={hasApplied} className="gap-2">
                  <UserPlus className="w-4 h-4" /> {hasApplied ? "รออนุมัติ" : "สมัครเข้าชุมนุม"}
                </Button>
              )}
            </div>
          </div>
          {club.goals && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm">
              <div className="font-medium mb-1 flex items-center gap-1"><Sparkles className="w-4 h-4 text-primary" /> เป้าหมาย/วัตถุประสงค์</div>
              <p className="text-muted-foreground whitespace-pre-wrap">{club.goals}</p>
            </div>
          )}
        </CardHeader>
      </Card>

      <EditClubDialog open={editOpen} onOpenChange={setEditOpen} club={club} onDone={load} />
      <QrJoinDialog open={qrOpen} onOpenChange={setQrOpen} url={joinUrl} clubName={club.name} />

      <Tabs defaultValue="feed" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="feed">ฟีดกิจกรรม</TabsTrigger>
          <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
          <TabsTrigger value="members">สมาชิก ({activeMembers.length})</TabsTrigger>
          <TabsTrigger value="attendance">เช็คชื่อ</TabsTrigger>
          <TabsTrigger value="works">ผลงาน</TabsTrigger>
          <TabsTrigger value="announcements">ประกาศ</TabsTrigger>
          {canManage && <TabsTrigger value="applications">รับสมัคร ({apps.filter((a) => a.status === "pending").length})</TabsTrigger>}
          <TabsTrigger value="advisors">ครูประจำชุมนุม</TabsTrigger>
        </TabsList>

        {/* FEED */}
        <TabsContent value="feed" className="space-y-3">
          {(canManage || isMember) && <FeedComposer clubId={id!} authorId={userId!} onDone={load} />}
          {feed.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">ยังไม่มีโพสต์ในชุมนุม</CardContent></Card>}
          {feed.map((p) => (
            <FeedPost key={p.id} post={p} canDelete={isAdmin || isAdvisor || p.author_id === userId} onDelete={async () => { await supabase.from("club_feed_posts").delete().eq("id", p.id); load(); }} />
          ))}
        </TabsContent>


        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Users} label="สมาชิก" value={activeMembers.length} />
            <StatCard icon={Crown} label="คณะกรรมการ" value={activeMembers.filter((m) => m.position !== "member").length} />
            <StatCard icon={Trophy} label="ผลงาน" value={works.length} />
            <StatCard icon={Megaphone} label="ประกาศ" value={anns.length} />
          </div>
          {anns.filter((a) => a.pinned).slice(0, 3).map((a) => (
            <Card key={a.id} className="border-warning/40 bg-warning/5">
              <CardContent className="p-3">
                <div className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-warning" /><span className="font-semibold">{a.title}</span></div>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* MEMBERS */}
        <TabsContent value="members">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>รหัส</TableHead><TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead>ตำแหน่ง</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {activeMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.students?.student_code}</TableCell>
                      <TableCell>{m.students?.prefix}{m.students?.first_name} {m.students?.last_name}</TableCell>
                      <TableCell>
                        {canManage ? (
                          <Select value={m.position} onValueChange={(v) => changePosition(m.id, v)}>
                            <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>{POSITIONS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={m.position === "president" ? "default" : "secondary"}>{POSITIONS.find((p) => p.v === m.position)?.l}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}><X className="w-4 h-4" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {activeMembers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">ยังไม่มีสมาชิก</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATTENDANCE */}
        <TabsContent value="attendance" className="space-y-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3 flex-wrap">
              <Label>วันที่:</Label>
              <Input type="date" className="w-44" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
              <div className="flex gap-2 text-sm">
                <Badge className="bg-success text-success-foreground">มา {stats.present}</Badge>
                <Badge variant="destructive">ขาด {stats.absent}</Badge>
                <Badge variant="secondary">สาย {stats.late}</Badge>
                <Badge variant="outline">รวม {stats.total} ({stats.pct}%)</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>รหัส</TableHead><TableHead>ชื่อ</TableHead><TableHead className="text-right">สถานะ</TableHead></TableRow></TableHeader>
                <TableBody>
                  {activeMembers.map((m) => {
                    const st = attendance[m.student_id];
                    return (
                      <TableRow key={m.id}>
                        <TableCell>{m.students?.student_code}</TableCell>
                        <TableCell>{m.students?.prefix}{m.students?.first_name} {m.students?.last_name}</TableCell>
                        <TableCell className="text-right">
                          {canManage ? (
                            <div className="flex gap-1 justify-end">
                              {["present", "late", "absent", "excused"].map((s) => (
                                <Button key={s} size="sm" variant={st === s ? "default" : "outline"} onClick={() => setAtt(m.student_id, s)}>
                                  {s === "present" ? "มา" : s === "late" ? "สาย" : s === "absent" ? "ขาด" : "ลา"}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <Badge variant={st === "present" ? "default" : "outline"}>{st || "-"}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WORKS */}
        <TabsContent value="works" className="space-y-3">
          {canManage && <AddWorkButton clubId={id!} onDone={load} />}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {works.map((w) => (
              <Card key={w.id}>
                {w.cover_url && <img src={w.cover_url} className="w-full h-40 object-cover rounded-t-lg" />}
                <CardContent className="p-3">
                  <h4 className="font-semibold">{w.title}</h4>
                  <p className="text-xs text-muted-foreground">{w.work_date}</p>
                  {w.award && <Badge className="mt-1 bg-warning text-warning-foreground">{w.award}</Badge>}
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{w.description}</p>
                </CardContent>
              </Card>
            ))}
            {works.length === 0 && <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">ยังไม่มีผลงาน</CardContent></Card>}
          </div>
        </TabsContent>

        {/* ANNOUNCEMENTS */}
        <TabsContent value="announcements" className="space-y-3">
          {canManage && <AddAnnouncementButton clubId={id!} onDone={load} />}
          <div className="space-y-2">
            {anns.map((a) => (
              <Card key={a.id} className={a.pinned ? "border-warning/40 bg-warning/5" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.pinned && <Star className="w-4 h-4 text-warning" />}
                    <span className="font-semibold">{a.title}</span>
                    <Badge variant="outline" className="text-xs">{a.kind}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(a.created_at).toLocaleString("th-TH")}</p>
                </CardContent>
              </Card>
            ))}
            {anns.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">ยังไม่มีประกาศ</CardContent></Card>}
          </div>
        </TabsContent>

        {/* APPLICATIONS */}
        {canManage && (
          <TabsContent value="applications">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>รหัส</TableHead><TableHead>ชื่อ</TableHead><TableHead>เหตุผล</TableHead><TableHead>สถานะ</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {apps.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.students?.student_code}</TableCell>
                      <TableCell>{a.students?.prefix}{a.students?.first_name} {a.students?.last_name}</TableCell>
                      <TableCell className="text-xs">{a.reason || "-"}</TableCell>
                      <TableCell><Badge variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}>{a.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        {a.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" onClick={() => approveApp(a)}><Check className="w-4 h-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => rejectApp(a)}><X className="w-4 h-4" /></Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {apps.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">ยังไม่มีใบสมัคร</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        )}

        {/* ADVISORS */}
        <TabsContent value="advisors" className="space-y-3">
          {isAdmin && <AddAdvisorButton clubId={id!} onDone={load} />}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {advisors.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  {a.profiles?.avatar_url ? <img src={a.profiles.avatar_url} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-muted" />}
                  <div className="flex-1">
                    <div className="font-semibold">{a.profiles?.first_name} {a.profiles?.last_name} {a.profiles?.nickname && `(${a.profiles.nickname})`}</div>
                    <p className="text-xs text-muted-foreground">{a.profiles?.position_title || a.role_title || "ครูที่ปรึกษา"}</p>
                    {a.is_lead && <Badge className="mt-1 text-xs">หัวหน้าครูประจำชุมนุม</Badge>}
                  </div>
                  {isAdmin && <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("club_advisors").delete().eq("id", a.id); load(); }}><X className="w-4 h-4" /></Button>}
                </CardContent>
              </Card>
            ))}
            {advisors.length === 0 && <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">ยังไม่ได้กำหนดครูประจำชุมนุม</CardContent></Card>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: any) {
  return <Card><CardContent className="p-3 flex items-center gap-2"><Icon className="w-5 h-5 text-primary" /><div><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-bold">{value}</div></div></CardContent></Card>;
}

function AddWorkButton({ clubId, onDone }: { clubId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", work_date: new Date().toISOString().slice(0, 10), award: "", cover_url: "" });
  const submit = async () => {
    if (!f.title) return toast.error("ระบุชื่อผลงาน");
    const { error } = await supabase.from("club_works").insert({ ...f, club_id: clubId });
    if (error) return toast.error(error.message);
    toast.success("เพิ่มผลงานแล้ว"); setOpen(false); onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> เพิ่มผลงาน</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>เพิ่มผลงาน</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div><Label>ชื่อผลงาน</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><Label>วันที่</Label><Input type="date" value={f.work_date} onChange={(e) => setF({ ...f, work_date: e.target.value })} /></div>
          <div><Label>รางวัล/ระดับ</Label><Input value={f.award} onChange={(e) => setF({ ...f, award: e.target.value })} /></div>
          <div><Label>ภาพปกผลงาน</Label><PhotoUploadField value={f.cover_url} onChange={(url) => setF({ ...f, cover_url: url || "" })} bucket="cms-images" folder="club-works" /></div>
          <div><Label>รายละเอียด</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>บันทึก</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAnnouncementButton({ clubId, onDone }: { clubId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", body: "", kind: "general", pinned: false, audience: "members" });
  const submit = async () => {
    if (!f.title) return toast.error("ระบุหัวข้อ");
    const { error } = await supabase.from("club_announcements").insert({ ...f, club_id: clubId });
    if (error) return toast.error(error.message);
    toast.success("ประกาศแล้ว"); setOpen(false); setF({ title: "", body: "", kind: "general", pinned: false, audience: "members" }); onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-1"><Megaphone className="w-4 h-4" /> ประกาศ</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>สร้างประกาศ</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div><Label>หัวข้อ</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><Label>เนื้อหา</Label><Textarea rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>ประเภท</Label>
              <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">ทั่วไป</SelectItem>
                  <SelectItem value="recruit">รับสมัคร</SelectItem>
                  <SelectItem value="event">กิจกรรม</SelectItem>
                  <SelectItem value="notice">แจ้งเตือน</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>ผู้รับ</Label>
              <Select value={f.audience} onValueChange={(v) => setF({ ...f, audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="members">สมาชิก</SelectItem>
                  <SelectItem value="all">ทุกคน</SelectItem>
                  <SelectItem value="applicants">ผู้สมัคร</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between"><Label>ปักหมุด</Label><Switch checked={f.pinned} onCheckedChange={(v) => setF({ ...f, pinned: v })} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>บันทึก</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAdvisorButton({ clubId, onDone }: { clubId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<any[]>([]);
  const [lead, setLead] = useState(false);

  useEffect(() => {
    if (!open || !q.trim()) { setOpts([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id,first_name,last_name,nickname,position_title")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,nickname.ilike.%${q}%`).limit(10);
      setOpts(data || []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const add = async (teacherId: string) => {
    const { error } = await supabase.from("club_advisors").insert({ club_id: clubId, teacher_id: teacherId, is_lead: lead });
    if (error) return toast.error(error.message);
    toast.success("เพิ่มครูแล้ว"); setOpen(false); setQ(""); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> เพิ่มครูประจำชุมนุม</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>เพิ่มครูประจำชุมนุม</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Input placeholder="ค้นหาชื่อครู..." value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex items-center justify-between"><Label>หัวหน้าครูประจำชุมนุม</Label><Switch checked={lead} onCheckedChange={setLead} /></div>
          <div className="max-h-60 overflow-y-auto divide-y">
            {opts.map((o) => (
              <button key={o.id} className="w-full text-left p-2 hover:bg-muted" onClick={() => add(o.id)}>
                <div className="font-medium">{o.first_name} {o.last_name} {o.nickname && `(${o.nickname})`}</div>
                <div className="text-xs text-muted-foreground">{o.position_title}</div>
              </button>
            ))}
            {q && opts.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">ไม่พบ</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditClubDialog({ open, onOpenChange, club, onDone }: any) {
  const [f, setF] = useState({ name: club.name, description: club.description || "", logo_url: club.logo_url || "", cover_url: club.cover_url || "", recruit_open: club.recruit_open });
  useEffect(() => { setF({ name: club.name, description: club.description || "", logo_url: club.logo_url || "", cover_url: club.cover_url || "", recruit_open: club.recruit_open }); }, [club]);
  const save = async () => {
    const { error } = await supabase.from("clubs").update(f).eq("id", club.id);
    if (error) return toast.error(error.message);
    toast.success("บันทึกแล้ว"); onOpenChange(false); onDone();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>แก้ไขชุมนุม</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>โลโก้ชุมนุม (Clan Icon)</Label>
              <PhotoUploadField value={f.logo_url} onChange={(url) => setF({ ...f, logo_url: url || "" })} bucket="cms-images" folder="club-logos" />
            </div>
            <div>
              <Label>ภาพปก (Banner)</Label>
              <PhotoUploadField value={f.cover_url} onChange={(url) => setF({ ...f, cover_url: url || "" })} bucket="cms-images" folder="club-covers" />
            </div>
          </div>
          <div><Label>ชื่อชุมนุม</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>รายละเอียด</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="flex items-center justify-between"><Label>เปิดรับสมัคร</Label><Switch checked={f.recruit_open} onCheckedChange={(v) => setF({ ...f, recruit_open: v })} /></div>
        </div>
        <DialogFooter><Button onClick={save}>บันทึก</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QrJoinDialog({ open, onOpenChange, url, clubName }: any) {
  const copy = () => { navigator.clipboard.writeText(url); toast.success("คัดลอกลิงก์แล้ว"); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><QrCode className="w-5 h-5" /> QR สมัครสมาชิก</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-sm text-muted-foreground text-center">ให้นักเรียนแสกน QR นี้เพื่อส่งใบสมัคร<br/><span className="font-semibold text-foreground">{clubName}</span></p>
          <div className="p-4 bg-white rounded-xl ring-1 ring-border">
            <QRCodeSVG value={url} size={220} level="M" includeMargin />
          </div>
          <p className="text-xs text-muted-foreground break-all text-center">{url}</p>
          <p className="text-xs text-muted-foreground text-center">⚠️ ใบสมัครจะถูกส่งให้ครูประจำชุมนุมอนุมัติ</p>
          <Button variant="outline" size="sm" onClick={copy}>คัดลอกลิงก์</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeedComposer({ clubId, authorId, onDone }: { clubId: string; authorId: string; onDone: () => void }) {
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!body.trim() && images.length === 0) return toast.error("ระบุข้อความหรือเพิ่มรูป");
    setBusy(true);
    const { error } = await supabase.from("club_feed_posts").insert({ club_id: clubId, author_id: authorId, body: body.trim() || null, images });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody(""); setImages([]); onDone();
    toast.success("โพสต์แล้ว");
  };

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <Textarea rows={2} placeholder="แชร์ข่าวสาร / กิจกรรม / อัพเดทของชุมนุม..." value={body} onChange={(e) => setBody(e.target.value)} />
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((u, i) => (
              <div key={i} className="relative group">
                <img src={u} className="w-full h-24 object-cover rounded" />
                <Button size="icon" variant="destructive" className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100" onClick={() => setImages(images.filter((_, j) => j !== i))}><X className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <PhotoUploadField value="" onChange={(url) => url && setImages([...images, url])} bucket="cms-images" folder="club-feed" />
          </div>
          <Button size="sm" onClick={submit} disabled={busy} className="gap-1"><Newspaper className="w-4 h-4" /> โพสต์</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FeedPost({ post, canDelete, onDelete }: any) {
  const p = post.profiles;
  const imgs: string[] = Array.isArray(post.images) ? post.images : [];
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          {p?.avatar_url ? <img src={p.avatar_url} className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-muted" />}
          <div className="flex-1">
            <div className="text-sm font-semibold">{p?.first_name} {p?.last_name} {p?.nickname && <span className="text-muted-foreground font-normal">({p.nickname})</span>}</div>
            <div className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleString("th-TH")}</div>
          </div>
          {canDelete && <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="w-4 h-4" /></Button>}
        </div>
        {post.body && <p className="text-sm whitespace-pre-wrap">{post.body}</p>}
        {imgs.length > 0 && (
          <div className={`grid gap-2 ${imgs.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
            {imgs.map((u, i) => <img key={i} src={u} className="w-full rounded-lg object-cover max-h-80" />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

