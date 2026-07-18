import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trophy, Calendar, MapPin, CheckCircle2, AlertCircle, ArrowLeft, Search, X, Users, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { formatDateBE } from "@/lib/dateBE";
import { formatFullNamePlain } from "@/lib/nameFormat";

type StudentRow = {
  id: string;
  prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  student_code: string | null;
  classroom_id: string | null;
  classrooms?: { name: string | null } | null;
};

export default function ActivityRegisterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activity, setActivity] = useState<any>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [already, setAlready] = useState<any>(null);
  const [teamName, setTeamName] = useState("");
  const [isTeam, setIsTeam] = useState(false);
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Team member search/selection
  const [members, setMembers] = useState<StudentRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [classrooms, setClassrooms] = useState<{ id: string; name: string; grade_level: string | null }[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [searchResults, setSearchResults] = useState<StudentRow[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate(`/login?redirect=${encodeURIComponent(`/dashboard/activities/${id}/register`)}`);
          return;
        }
        const [a, s, c] = await Promise.all([
          (supabase as any).from("activities").select("*").eq("id", id).maybeSingle(),
          (supabase as any).from("students")
            .select("id, prefix, first_name, last_name, student_code, classroom_id, classrooms!students_classroom_id_fkey(name)")
            .eq("auth_user_id", user.id).maybeSingle(),
          (supabase as any).from("classrooms").select("id, name, grade_level").order("name"),
        ]);
        setActivity(a.data);
        setStudent(s.data);
        setClassrooms(c.data || []);
        if (s.data) {
          const { data: existing } = await (supabase as any).from("activity_participants")
            .select("*").eq("activity_id", id).eq("student_id", s.data.id).maybeSingle();
          setAlready(existing);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  // Debounced student search
  useEffect(() => {
    if (!isTeam) return;
    const term = searchTerm.trim();
    if (!term && classFilter === "all" && gradeFilter === "all") {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      let q = (supabase as any).from("students")
        .select("id, prefix, first_name, last_name, student_code, classroom_id, classrooms!students_classroom_id_fkey(name, grade_level)")
        .limit(30);
      if (term) {
        q = q.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,student_code.ilike.%${term}%`);
      }
      if (classFilter !== "all") q = q.eq("classroom_id", classFilter);
      const { data } = await q;
      let rows: StudentRow[] = data || [];
      if (gradeFilter !== "all") {
        rows = rows.filter((r: any) => r.classrooms?.grade_level === gradeFilter);
      }
      // exclude self & already selected
      const exclude = new Set([student?.id, ...members.map((m) => m.id)].filter(Boolean) as string[]);
      setSearchResults(rows.filter((r) => !exclude.has(r.id)));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [searchTerm, classFilter, gradeFilter, isTeam, members, student?.id]);

  const grades = useMemo(() => {
    const set = new Set(classrooms.map((c) => c.grade_level).filter(Boolean) as string[]);
    return Array.from(set);
  }, [classrooms]);

  const filteredClassrooms = useMemo(() => {
    if (gradeFilter === "all") return classrooms;
    return classrooms.filter((c) => c.grade_level === gradeFilter);
  }, [classrooms, gradeFilter]);

  const addMember = (s: StudentRow) => {
    setMembers((m) => [...m, s]);
    setSearchResults((r) => r.filter((x) => x.id !== s.id));
  };
  const removeMember = (sid: string) => setMembers((m) => m.filter((x) => x.id !== sid));

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      return toast.error("รองรับเฉพาะไฟล์ PNG หรือ JPG");
    }
    if (file.size > 5 * 1024 * 1024) return toast.error("ไฟล์ต้องไม่เกิน 5MB");
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop() || "png";
      const path = `team-logos/${user?.id}/${id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("wall-media").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage.from("wall-media").createSignedUrl(path, 60 * 60 * 24 * 365);
      setTeamLogo(data?.signedUrl || "");
      toast.success("อัปโหลดรูปทีมเรียบร้อย");
    } catch (e: any) {
      toast.error(e?.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const register = async () => {
    if (!student || !id) return;
    if (isTeam && !teamName.trim()) return toast.error("กรุณาใส่ชื่อทีม");
    setSubmitting(true);
    if (activity?.max_participants) {
      const { count } = await (supabase as any)
        .from("activity_participants")
        .select("id", { count: "exact", head: true })
        .eq("activity_id", id);
      const incoming = isTeam ? 1 + members.length : 1;
      if ((count ?? 0) + incoming > activity.max_participants) {
        setSubmitting(false);
        return toast.error("ผู้สมัครเต็มแล้ว");
      }
    }
    const baseTeam = {
      activity_id: id,
      team_name: isTeam ? teamName.trim() : null,
      team_logo_url: isTeam ? teamLogo : null,
      team_members: isTeam ? members.map((m) => m.id) : [],
    };
    // Leader row
    const rows = [
      { ...baseTeam, student_id: student.id, is_team_leader: isTeam },
      ...(isTeam ? members.map((m) => ({ ...baseTeam, student_id: m.id, is_team_leader: false })) : []),
    ];
    const { error, data } = await (supabase as any).from("activity_participants")
      .insert(rows).select("*");
    setSubmitting(false);
    if (error) return toast.error(error.message || "ลงทะเบียนไม่สำเร็จ");
    setAlready(data?.[0]);
    toast.success(isTeam ? `ลงทะเบียนทีม ${teamName} เรียบร้อย!` : "ลงทะเบียนเรียบร้อย!");
  };

  const withdraw = async () => {
    if (!already) return;
    if (!confirm("ยืนยันการถอนตัวออกจากการแข่งขัน?")) return;
    // If this was a team registration, remove all teammates too
    let q = (supabase as any).from("activity_participants").delete().eq("activity_id", id);
    if (already.team_name) q = q.eq("team_name", already.team_name);
    else q = q.eq("id", already.id);
    const { error } = await q;
    if (error) return toast.error(error.message);
    setAlready(null);
    toast.success("ถอนตัวเรียบร้อย");
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!activity) {
    return <Card><CardContent className="py-12 text-center">ไม่พบกิจกรรม</CardContent></Card>;
  }

  const isStudent = !!student;
  const open = activity.registration_open && (!activity.registration_deadline || new Date(activity.registration_deadline) > new Date());

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/activities/${id}`)} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> กลับหน้ากิจกรรม
      </Button>

      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl gradient-primary"><Trophy className="h-6 w-6 text-white" /></div>
            <div className="flex-1">
              <CardTitle className="text-xl">{activity.title}</CardTitle>
              <CardDescription className="flex flex-wrap gap-3 text-xs mt-1">
                {activity.start_at && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDateBE(activity.start_at)}</span>}
                {activity.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{activity.location}</span>}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        {activity.rules && (
          <CardContent>
            <Label className="text-xs text-muted-foreground">กฎ/กติกา</Label>
            <pre className="text-sm whitespace-pre-wrap font-sans mt-1">{activity.rules}</pre>
          </CardContent>
        )}
      </Card>

      {!isStudent ? (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-warning mx-auto" />
            <div className="font-semibold">เฉพาะบัญชีนักเรียน</div>
            <div className="text-sm text-muted-foreground">บัญชีของคุณไม่ได้เชื่อมกับนักเรียน กรุณาเข้าสู่ระบบด้วยบัญชีนักเรียน</div>
          </CardContent>
        </Card>
      ) : already ? (
        <Card>
          <CardContent className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
            <div className="font-semibold text-lg">คุณลงทะเบียนแล้ว</div>
            <div className="text-sm text-muted-foreground">
              {formatFullNamePlain(student!.prefix, student!.first_name, student!.last_name)}
              {student!.classrooms?.name && ` • ${student!.classrooms.name}`}
            </div>
            {already.team_logo_url && (
              <img src={already.team_logo_url} alt="logo ทีม" className="w-20 h-20 mx-auto rounded-xl object-cover border" />
            )}
            {already.team_name && <Badge variant="secondary">ทีม: {already.team_name}</Badge>}
            <div className="pt-2">
              <Button variant="outline" onClick={withdraw}>ถอนตัวออก</Button>
            </div>
          </CardContent>
        </Card>
      ) : !open ? (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
            <div className="font-semibold">ยังไม่เปิด/ปิดรับสมัครแล้ว</div>
            <div className="text-sm text-muted-foreground">กรุณาติดต่อครูผู้รับผิดชอบ</div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">ลงทะเบียนแข่งขัน</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/40 p-3 rounded-md text-sm">
              <div className="font-semibold">{formatFullNamePlain(student!.prefix, student!.first_name, student!.last_name)}</div>
              <div className="text-xs text-muted-foreground">
                รหัส {student!.student_code} {student!.classrooms?.name && `• ${student!.classrooms.name}`}
              </div>
              <div className="text-[11px] text-primary mt-1">(หัวหน้าทีม)</div>
            </div>

            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md">
              <div>
                <Label className="font-medium">สมัครแบบทีม</Label>
                <p className="text-xs text-muted-foreground">เปิดเพื่อใส่ชื่อทีม, เลือกสมาชิก, และอัปโหลดโลโก้</p>
              </div>
              <Switch checked={isTeam} onCheckedChange={setIsTeam} />
            </div>

            {isTeam && (
              <div className="space-y-4 border-l-2 border-primary/30 pl-3">
                <div>
                  <Label>ชื่อทีม *</Label>
                  <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="เช่น Lightning Squad" maxLength={80} />
                </div>

                {/* Team logo */}
                <div>
                  <Label className="flex items-center gap-2"><ImagePlus className="w-4 h-4" /> โลโก้/รูปทีม (PNG, JPG)</Label>
                  <div className="flex items-center gap-3 mt-2">
                    {teamLogo ? (
                      <div className="relative">
                        <img src={teamLogo} alt="team logo" className="w-20 h-20 rounded-xl object-cover border" />
                        <button
                          type="button"
                          onClick={() => setTeamLogo(null)}
                          className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center text-muted-foreground">
                        <ImagePlus className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                      />
                      <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {teamLogo ? "เปลี่ยนรูป" : "อัปโหลด"}
                      </Button>
                      <p className="text-[11px] text-muted-foreground mt-1">ไม่เกิน 5MB</p>
                    </div>
                  </div>
                </div>

                {/* Selected members */}
                <div>
                  <Label className="flex items-center gap-2"><Users className="w-4 h-4" /> สมาชิกทีม ({members.length} คน)</Label>
                  {members.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {members.map((m) => (
                        <Badge key={m.id} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                          {formatFullNamePlain(m.prefix, m.first_name, m.last_name)}
                          {m.classrooms?.name && <span className="text-[10px] opacity-70">• {m.classrooms.name}</span>}
                          <button type="button" onClick={() => removeMember(m.id)} className="hover:bg-destructive/20 rounded-full p-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search & filters */}
                <div className="space-y-2 bg-muted/20 p-3 rounded-md">
                  <Label className="text-sm">ค้นหา/เพิ่มสมาชิก</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="พิมพ์ชื่อ หรือรหัสประจำตัวนักเรียน"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setClassFilter("all"); }}>
                      <SelectTrigger><SelectValue placeholder="ระดับชั้น" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                        {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={classFilter} onValueChange={setClassFilter}>
                      <SelectTrigger><SelectValue placeholder="ห้อง" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทุกห้อง</SelectItem>
                        {filteredClassrooms.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Results */}
                  <div className="max-h-64 overflow-y-auto rounded border bg-background">
                    {searching ? (
                      <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />กำลังค้นหา...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        พิมพ์ชื่อ/รหัส หรือเลือกตัวกรองเพื่อค้นหานักเรียน
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {searchResults.map((s) => (
                          <li key={s.id} className="flex items-center justify-between p-2 hover:bg-muted/40">
                            <div className="text-sm">
                              <div className="font-medium">{formatFullNamePlain(s.prefix, s.first_name, s.last_name)}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {s.student_code} {s.classrooms?.name && `• ${s.classrooms.name}`}
                              </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => addMember(s)}>เพิ่ม</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Button onClick={register} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ยืนยันลงทะเบียน {isTeam && members.length > 0 && `(${1 + members.length} คน)`}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              ข้อมูลจะแสดงแก่ครูผู้จัดและกรรมการ
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
