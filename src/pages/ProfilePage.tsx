import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Camera, User, Mail, Phone, MapPin, Heart,
  Calendar, Droplets, MessageCircle, Facebook, Briefcase,
  Building, GraduationCap, Shield, Save, Pencil, IdCard,
  BookOpen, Clock, Users, ClipboardList, BarChart3, FileText, TrendingUp,
  FileCheck, Eye, Printer, Download, ListTodo, CheckCircle2, AlertTriangle,
  ShieldCheck, ExternalLink, MessageSquare, Trash2, Pin, Image as ImageIcon
} from "lucide-react";
import { useIdCardSettings } from "@/hooks/useIdCardSettings";
import { IdCardFront, IdCardBack } from "@/components/IdCardRenderer";
import { PdpaConsentCard } from "@/components/PdpaConsentCard";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";
import { useProfileImageUrl } from "@/lib/profileImageUrl";
import MyPostsTab from "@/components/profile/MyPostsTab";
import MyMembershipsCard from "@/components/profile/MyMembershipsCard";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { formatDateBE } from "@/lib/dateBE";
import { saveErrorMessage } from "@/lib/saveError";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  phone: string | null;
  avatar_url: string | null;
  avatar_full_url?: string | null;
  cover_photo_url: string | null;
  cover_thumb_url?: string | null;
  bio: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  line_id: string | null;
  facebook_url: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  blood_type: string | null;
  student_code: string | null;
  employee_code: string | null;
  position_title: string | null;
  department: string | null;
  pdpa_accepted_at?: string | null;
  pdpa_version?: string | null;
}

const SUBJECT_GROUPS = [
  "ปฐมวัย",
  "ภาษาไทย", "คณิตศาสตร์", "วิทยาศาสตร์และเทคโนโลยี",
  "สังคมศึกษา ศาสนาและวัฒนธรรม", "สุขศึกษาและพลศึกษา",
  "ศิลปะ", "การงานอาชีพ", "ภาษาต่างประเทศ",
];

const DEPARTMENTS = [
  "ฝ่ายวิชาการ", "ฝ่ายกิจการนักเรียน", "ฝ่ายบริหารทั่วไป",
  "ฝ่ายงบประมาณและบุคคล", "ฝ่ายอาคารสถานที่", "ฝ่ายแผนงานและประกันคุณภาพ",
  "ConnextED",
];

const POSITIONS = [
  "ครู", "ครูผู้ช่วย", "ครูอัตราจ้าง", "พนักงานราชการ",
  "ผู้อำนวยการ", "รองผู้อำนวยการ", "ลูกจ้างประจำ", "ลูกจ้างชั่วคราว",
  "ICT Talent", "School Partner", "ConnextED",
];

const ProfilePage = () => {
  const { role, userId } = useUserRole();
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subjectGroup, setSubjectGroup] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchProfile = async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) {
        console.error("Profile fetch error:", error);
      }
      if (data) {
        setProfile(data as unknown as Profile);
      } else {
        // Create a default empty profile so page doesn't stay loading
        setProfile({
          id: userId,
          first_name: null, last_name: null, nickname: null, phone: null,
          avatar_url: null, cover_photo_url: null, bio: null, date_of_birth: null,
          gender: null, address: null, line_id: null, facebook_url: null,
          emergency_contact: null, emergency_phone: null, blood_type: null,
          student_code: null, employee_code: null, position_title: null, department: null,
        });
      }
      const { data: { session } } = await supabase.auth.getSession();
      setUserEmail(session?.user?.email || "");
    };
    fetchProfile();
  }, [userId]);

  // === Teacher data (linked via user_id) ===
  const { data: linkedPersonnel } = useQuery({
    queryKey: ["profile_linked_personnel", userId],
    enabled: (role === "teacher" || role === "admin" || role === "director") && !!userId,
    queryFn: async () => {
      // Trust FK only — name-string fallback collides on common names and shows the wrong record.
      // The auto_link_personnel_on_profile trigger backfills user_id when profile is set up.
      const { data } = await supabase
        .from("personnel")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  // Sync subjectGroup state from personnel record once it's loaded
  useEffect(() => {
    if (linkedPersonnel && (linkedPersonnel as any).subject_group != null) {
      setSubjectGroup((linkedPersonnel as any).subject_group || "");
    }
  }, [linkedPersonnel]);

  const { data: teacherAssignments } = useQuery({
    queryKey: ["profile_teacher_assignments", linkedPersonnel?.id],
    enabled: role === "teacher" && !!linkedPersonnel?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("teacher_assignments")
        .select("*, subjects(name_th, code), classrooms(name, grade_level)")
        .eq("personnel_id", linkedPersonnel!.id);
      return data || [];
    },
  });

  const { data: teacherSchedules } = useQuery({
    queryKey: ["profile_teacher_schedules", linkedPersonnel?.id],
    enabled: role === "teacher" && !!linkedPersonnel?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("schedules")
        .select("*, subjects(name_th), classrooms(name)")
        .eq("teacher_id", linkedPersonnel!.id)
        .order("day_of_week")
        .order("period");
      return data || [];
    },
  });

  const { data: teacherHomeroom } = useQuery({
    queryKey: ["profile_teacher_homeroom", linkedPersonnel?.id],
    enabled: role === "teacher" && !!linkedPersonnel?.id,
    queryFn: async () => {
      const pid = linkedPersonnel!.id;
      const { data } = await supabase
        .from("classrooms")
        .select("*")
        .or(`homeroom_teacher_id.eq.${pid},homeroom_teacher_2_id.eq.${pid}`);
      return data || [];
    },
  });

  // === Student data ===
  const { data: studentRecord } = useQuery({
    queryKey: ["profile_student_record", userId],
    enabled: role === "student" && !!userId,
    queryFn: async () => {
      const cols = "*, classrooms!students_classroom_id_fkey(name, grade_level, homeroom_teacher, homeroom_teacher_2, homeroom_teacher_id, homeroom_teacher_2_id)";
      // Primary: match by auth_user_id
      const { data } = await supabase
        .from("students")
        .select(cols)
        .eq("auth_user_id", userId!)
        .maybeSingle();
      if (data) return data;
      // Fallback: match by student_code from profile
      if (profile?.student_code) {
        const { data: fallback } = await supabase
          .from("students")
          .select(cols)
          .eq("student_code", profile.student_code)
          .maybeSingle();
        return fallback;
      }
      return null;
    },
  });

  const { data: studentScores } = useQuery({
    queryKey: ["profile_student_scores", studentRecord?.id],
    enabled: role === "student" && !!studentRecord?.id && !!studentRecord?.student_code,
    queryFn: async () => {
      const code = studentRecord!.student_code;
      if (!code) return [];
      const { data } = await supabase
        .from("student_scores")
        .select("*, subjects(name_th, code)")
        .eq("student_code", code)
        .order("academic_year", { ascending: false });
      return data || [];
    },
  });

  const { data: studentSchedules } = useQuery({
    queryKey: ["profile_student_schedules", studentRecord?.classroom_id],
    enabled: role === "student" && !!studentRecord?.classroom_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("schedules")
        .select("*, subjects(name_th), classrooms(name)")
        .eq("classroom_id", studentRecord!.classroom_id!)
        .order("day_of_week")
        .order("period");
      return data || [];
    },
  });

  // Fetch teachers for the student's classroom
  const { data: studentTeachers } = useQuery({
    queryKey: ["profile_student_teachers", studentRecord?.classroom_id],
    enabled: role === "student" && !!studentRecord?.classroom_id,
    queryFn: async () => {
      // Use security-definer RPC so students/parents can see subject teachers
      // without exposing personnel PII directly via RLS.
      const { data: rows } = await supabase.rpc("get_classroom_subject_teachers", {
        _classroom_id: studentRecord!.classroom_id!,
      });

      const teacherMap = new Map<string, any>();
      (rows || []).forEach((r: any) => {
        const existing = teacherMap.get(r.personnel_id);
        const subj = r.subject_name_th ? { name_th: r.subject_name_th, code: r.subject_code } : null;
        if (existing) {
          if (subj) existing.subjects.push(subj);
        } else {
          teacherMap.set(r.personnel_id, {
            personnel_id: r.personnel_id,
            prefix: r.prefix,
            first_name: r.first_name,
            last_name: r.last_name,
            position: r.position_name,
            department: r.department,
            email: r.email,
            phone: r.phone,
            subjects: subj ? [subj] : [],
          });
        }
      });
      return Array.from(teacherMap.values());
    },
  });

  // Fetch homeroom teacher profile(s) for students — supports up to 2 homeroom teachers
  const { data: homeroomTeacherProfiles = [] } = useQuery({
    queryKey: [
      "profile_homeroom_teachers",
      (studentRecord as any)?.classrooms?.homeroom_teacher_id,
      (studentRecord as any)?.classrooms?.homeroom_teacher_2_id,
      (studentRecord as any)?.classrooms?.homeroom_teacher,
      (studentRecord as any)?.classrooms?.homeroom_teacher_2,
    ],
    enabled: role === "student" && !!(studentRecord as any)?.classrooms,
    queryFn: async () => {
      const cls = (studentRecord as any)?.classrooms;
      if (!cls) return [];
      const results: any[] = [];
      const ids = [cls.homeroom_teacher_id, cls.homeroom_teacher_2_id].filter(Boolean);
      const names = [cls.homeroom_teacher, cls.homeroom_teacher_2].filter((n: any) => n && String(n).trim());
      // Prefer id-based lookup
      if (ids.length) {
        const { data } = await supabase.from("personnel").select("*").in("id", ids);
        if (data) results.push(...data);
      }
      // Fill in by name lookup for any slot that has a name but no matching id row
      for (const name of names) {
        const parts = String(name).trim().split(/\s+/);
        const first = parts[0];
        const last = parts.slice(1).join(" ");
        if (results.some((r) => r.first_name === first && r.last_name === last)) continue;
        const { data: p } = await supabase
          .from("personnel")
          .select("*")
          .eq("first_name", first)
          .eq("last_name", last)
          .maybeSingle();
        if (p) results.push(p);
        else results.push({ id: `name:${name}`, first_name: first, last_name: last, _nameOnly: true });
      }
      return results;
    },
  });

  // === Student tasks (all homework from all subjects) ===
  const { data: studentTasks = [] } = useQuery({
    queryKey: ["student_tasks", userId],
    enabled: role === "student" && !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_assignments")
        .select("*, subjects:subject_id(name_th, code)")
        .eq("assigned_to_user_id", userId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const updateTaskStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("task_assignments").update({ status }).eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("อัพเดทสถานะสำเร็จ");
    queryClient.invalidateQueries({ queryKey: ["student_tasks"] });
  };

  // === Director data ===
  const { data: directorStats } = useQuery({
    queryKey: ["director_stats"],
    enabled: role === "director" || role === "admin",
    queryFn: async () => {
      const [students, personnel, classrooms, subjects, attendance, presentAttendance] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("personnel").select("id", { count: "exact", head: true }),
        supabase.from("classrooms").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("status", "present"),
      ]);
      const totalAtt = attendance.count || 0;
      const presentAtt = presentAttendance.count || 0;
      return {
        students: students.count || 0,
        personnel: personnel.count || 0,
        classrooms: classrooms.count || 0,
        subjects: subjects.count || 0,
        attendanceRate: totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0,
      };
    },
  });

  // === My Documents (for all roles) ===
  const { data: myDocuments = [] } = useQuery({
    queryKey: ["profile_my_documents", profile?.first_name, profile?.department, role],
    enabled: !!profile?.first_name,
    queryFn: async () => {
      // Fetch all document_recipients
      const { data: allRecipients } = await supabase
        .from("document_recipients" as any)
        .select("*");
      if (!allRecipients || allRecipients.length === 0) return [];

      const fullName = `${profile?.first_name} ${profile?.last_name}`.trim();
      const dept = profile?.department || "";

      // Filter: match by name (personnel) or by department
      const myRecIds = (allRecipients as any[]).filter((r: any) => {
        if (r.recipient_type === "personnel" && r.recipient_name?.includes(fullName)) return true;
        if (r.recipient_type === "department" && dept && r.recipient_name === dept) return true;
        if (r.recipient_type === "department" && role === "director" && r.recipient_name === "ผู้อำนวยการ") return true;
        return false;
      });

      if (myRecIds.length === 0) return [];

      const docIds = [...new Set(myRecIds.map((r: any) => r.document_id))];
      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .in("id", docIds)
        .order("created_at", { ascending: false });

      return (docs || []).map((doc: any) => {
        const rec = myRecIds.find((r: any) => r.document_id === doc.id);
        return { ...doc, _recipientId: rec?.id, _isRead: rec?.is_read || false };
      });
    },
  });

  const markDocRead = async (recipientId: string) => {
    await supabase.from("document_recipients" as any).update({ is_read: true, read_at: new Date().toISOString() } as any).eq("id", recipientId);
    queryClient.invalidateQueries({ queryKey: ["profile_my_documents"] });
  };

  // === ID Card Template Settings (shared hook) ===
  const { settings: cs } = useIdCardSettings();

  /**
   * อัปโหลดรูปแบบ 2 ขนาด: full (สำหรับหน้าโปรไฟล์) + thumb (สำหรับ list/avatar เล็ก)
   * ลดขนาด + แปลงเป็น WebP อัตโนมัติเพื่อประหยัดแบนด์วิดท์
   */
  const uploadImagePair = async (
    file: File,
    folder: "avatar" | "cover"
  ): Promise<{ full: string; thumb: string } | null> => {
    const { compressImage } = await import("@/lib/imageCompress");
    const isAvatar = folder === "avatar";
    // full-size: avatar 512px / cover 1600px
    const full = await compressImage(file, {
      maxWidth: isAvatar ? 512 : 1600,
      maxHeight: isAvatar ? 512 : 1600,
      quality: 0.82,
      maxSizeKB: isAvatar ? 100 : 250,
      mimeType: "image/webp",
    });
    // thumbnail: 128px avatar / 480px cover, quality ต่ำลง — ใช้สำหรับ list/preview
    const thumb = await compressImage(file, {
      maxWidth: isAvatar ? 128 : 480,
      maxHeight: isAvatar ? 128 : 480,
      quality: 0.7,
      maxSizeKB: isAvatar ? 15 : 40,
      mimeType: "image/webp",
    });
    const ts = Date.now();
    const fullPath = `${userId}/${folder}_full_${ts}.webp`;
    const thumbPath = `${userId}/${folder}_thumb_${ts}.webp`;
    const [fullRes, thumbRes] = await Promise.all([
      uploadPublicFileWithFallback("profile-images", fullPath, full, { upsert: true, contentType: "image/webp" }),
      uploadPublicFileWithFallback("profile-images", thumbPath, thumb, { upsert: true, contentType: "image/webp" }),
    ]);
    if (fullRes.usedFallback || thumbRes.usedFallback) toast.info("ใช้โหมดสำรองสำหรับรูปภาพ");
    return { full: fullRes.publicUrl, thumb: thumbRes.publicUrl };
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const urls = await uploadImagePair(file, "avatar");
    if (urls) {
      // avatar_url = thumb (ใช้ในทุก list/nav), avatar_full_url = full (ใช้ในหน้าโปรไฟล์)
      setProfile({ ...profile, avatar_url: urls.thumb, avatar_full_url: urls.full } as any);
      await supabase.from("profiles").update({ avatar_url: urls.thumb, avatar_full_url: urls.full } as any).eq("id", userId!);
      toast.success("อัปโหลดรูปโปรไฟล์สำเร็จ");
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const urls = await uploadImagePair(file, "cover");
    if (urls) {
      setProfile({ ...profile, cover_photo_url: urls.full, cover_thumb_url: urls.thumb } as any);
      await supabase.from("profiles").update({ cover_photo_url: urls.full, cover_thumb_url: urls.thumb } as any).eq("id", userId!);
      toast.success("อัปโหลดรูปปกสำเร็จ");
    }
  };

  const handleSave = async () => {
    if (!profile || !userId) return;
    const __tid_save_1 = toast.loading("กำลังบันทึก...");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: profile.first_name,
      last_name: profile.last_name,
      nickname: profile.nickname,
      phone: profile.phone,
      bio: profile.bio,
      date_of_birth: profile.date_of_birth,
      gender: profile.gender,
      address: profile.address,
      line_id: profile.line_id,
      facebook_url: profile.facebook_url,
      emergency_contact: profile.emergency_contact,
      emergency_phone: profile.emergency_phone,
      blood_type: profile.blood_type,
      student_code: profile.student_code,
      employee_code: profile.employee_code,
      position_title: profile.position_title,
      department: profile.department,
    } as any).eq("id", userId);

    // Sync subject_group (หมวดวิชา) to personnel for teachers/director
    let personnelErr: any = null;
    if (linkedPersonnel?.id && (role === "teacher" || role === "director" || role === "admin")) {
      const { error: pErr } = await supabase
        .from("personnel")
        .update({ subject_group: subjectGroup || null, department: profile.department || undefined, position: profile.position_title || undefined } as any)
        .eq("id", linkedPersonnel.id);
      personnelErr = pErr;
    }

    if (error || personnelErr) toast.error((error || personnelErr)!.message);
    else {
      toast.success("บันทึกข้อมูลสำเร็จ");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["profile_linked_personnel", userId] });
    }
    toast.dismiss(__tid_save_1);
    setSaving(false);
  };

  const update = (field: keyof Profile, value: string) => {
    if (profile) setProfile({ ...profile, [field]: value });
  };

  const roleLabels: Record<string, string> = {
    admin: "ผู้ดูแลระบบ", teacher: "ครู / บุคลากร", student: "นักเรียน", director: "ผู้อำนวยการ",
  };
  const roleColors: Record<string, string> = {
    admin: "bg-destructive text-destructive-foreground", teacher: "bg-primary text-primary-foreground",
    student: "bg-green-600 text-white", director: "bg-amber-600 text-white",
  };

  const dayNames = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];

  const profileUrl = `${window.location.origin}/p/${userId}`;

  const handlePrintIdCard = useCallback(async () => {
    const frontEl = document.getElementById("id-card-front");
    const backEl = document.getElementById("id-card-back");
    if (!frontEl || !backEl) return;
    toast.info("กำลังสร้าง PDF...");
    try {
      await (document as any).fonts?.ready;

      const scale = 3;
      const frontCanvas = await html2canvas(frontEl, { scale, useCORS: true, backgroundColor: "#ffffff", logging: false });
      const backCanvas = await html2canvas(backEl, { scale, useCORS: true, backgroundColor: "#ffffff", logging: false });

      // ขนาดบัตรมาตรฐาน ISO ID-1: 54 x 86 mm + safe margin รอบบัตร (กันปริ้นเตอร์ตัดขอบ)
      const cardW = 54;
      const cardH = 86;
      const safe = 3; // mm — no-bleed margin
      const pageW = cardW + safe * 2;
      const pageH = cardH + safe * 2;
      const fitInto = (cw: number, ch: number) => {
        const r = cw / ch;
        const target = cardW / cardH;
        let w = cardW, h = cardH, x = safe, y = safe;
        if (r > target) { h = cardW / r; y = safe + (cardH - h) / 2; }
        else { w = cardH * r; x = safe + (cardW - w) / 2; }
        return { x, y, w, h };
      };

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, pageH] });
      const f = fitInto(frontCanvas.width, frontCanvas.height);
      pdf.addImage(frontCanvas.toDataURL("image/png"), "PNG", f.x, f.y, f.w, f.h);

      pdf.addPage([pageW, pageH], "portrait");
      const b = fitInto(backCanvas.width, backCanvas.height);
      pdf.addImage(backCanvas.toDataURL("image/png"), "PNG", b.x, b.y, b.w, b.h);

      pdf.save(`id-card-${profile?.first_name || "user"}.pdf`);
      toast.success("ดาวน์โหลด PDF สำเร็จ");
    } catch (err) {
      console.error(err);
      toast.error("ไม่สามารถสร้าง PDF ได้");
    }
  }, [profile]);

  const resolvedAvatarUrl = useProfileImageUrl((profile as any)?.avatar_full_url || profile?.avatar_url);

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">กำลังโหลดโปรไฟล์...</div>
      </div>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ";
  const initials = (profile.first_name?.[0] || "") + (profile.last_name?.[0] || "");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Cover Photo + Avatar */}
      <div className="relative rounded-2xl overflow-hidden shadow-lg">
        <div
          className="h-48 sm:h-64 bg-gradient-to-br from-primary/80 via-primary/60 to-accent/40 relative"
          style={profile.cover_photo_url ? { backgroundImage: `url(${profile.cover_photo_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <button onClick={() => coverInputRef.current?.click()} className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors">
            <Camera className="w-4 h-4" />
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        </div>
        <div className="bg-card px-6 pb-5 pt-0 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-16 sm:-mt-20">
            <div className="relative group">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-card bg-muted shadow-xl overflow-hidden">
                {resolvedAvatarUrl ? (
                  <img src={resolvedAvatarUrl} alt={fullName} className="w-full h-full object-cover" loading="eager" decoding="async" />


                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                    <span className="text-3xl sm:text-4xl font-bold text-primary-foreground">{initials || "?"}</span>
                  </div>
                )}
              </div>
              <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-1 right-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-2 shadow-lg transition-colors opacity-0 group-hover:opacity-100">
                <Camera className="w-4 h-4" />
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="flex-1 pb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{fullName}</h1>
              {profile.nickname && <p className="text-muted-foreground text-sm">"{profile.nickname}"</p>}
              <div className="flex items-center gap-2 mt-1.5">
                {role && <Badge className={`${roleColors[role]} text-xs`}>{roleLabels[role]}</Badge>}
                {profile.department && (role === "admin" || role === "director" || role === "teacher") && <Badge variant="outline" className="text-xs">{profile.department}</Badge>}
              </div>
              {profile.bio && <p className="text-sm text-muted-foreground mt-2 max-w-lg">{profile.bio}</p>}
            </div>
            <div className="sm:self-start sm:mt-4">
              {editing ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>ยกเลิก</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4 mr-1" />{saving ? "กำลังบันทึก..." : "บันทึก"}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="w-4 h-4 mr-1" /> แก้ไขโปรไฟล์
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <div className="w-full overflow-x-auto scrollbar-thin -mx-1 px-1">
          <TabsList className="inline-flex h-auto w-max gap-1 p-1 bg-muted/60 backdrop-blur-sm rounded-xl">
            <TabsTrigger value="info" className="shrink-0 h-9 px-3 text-xs sm:text-sm rounded-lg"><User className="w-4 h-4 mr-1.5" /> ข้อมูลส่วนตัว</TabsTrigger>
            <TabsTrigger value="contact" className="shrink-0 h-9 px-3 text-xs sm:text-sm rounded-lg"><Phone className="w-4 h-4 mr-1.5" /> การติดต่อ</TabsTrigger>
            {role === "teacher" && <TabsTrigger value="teaching" className="shrink-0 h-9 px-3 text-xs sm:text-sm rounded-lg"><BookOpen className="w-4 h-4 mr-1.5" /> ภาระงานสอน</TabsTrigger>}
            {role === "student" && <TabsTrigger value="academic" className="shrink-0 h-9 px-3 text-xs sm:text-sm rounded-lg"><GraduationCap className="w-4 h-4 mr-1.5" /> ผลการเรียน</TabsTrigger>}
            {role === "student" && <TabsTrigger value="teachers" className="shrink-0 h-9 px-3 text-xs sm:text-sm rounded-lg"><Users className="w-4 h-4 mr-1.5" /> ครูผู้สอน</TabsTrigger>}
            {role === "student" && <TabsTrigger value="sdq" className="shrink-0 h-9 px-3 text-xs sm:text-sm rounded-lg"><ClipboardList className="w-4 h-4 mr-1.5" /> ประเมิน SDQ</TabsTrigger>}
            {role === "student" && <TabsTrigger value="tasks" className="shrink-0 h-9 px-3 text-xs sm:text-sm rounded-lg"><ListTodo className="w-4 h-4 mr-1.5" /> ภาระงาน</TabsTrigger>}
            {(role === "director" || role === "admin") && <TabsTrigger value="overview" className="shrink-0 h-9 px-3 text-xs sm:text-sm rounded-lg"><BarChart3 className="w-4 h-4 mr-1.5" /> ภาพรวมโรงเรียน</TabsTrigger>}
            <TabsTrigger value="documents" className="shrink-0 h-9 px-3 text-xs sm:text-sm rounded-lg"><FileText className="w-4 h-4 mr-1.5" /> เอกสารของฉัน</TabsTrigger>
            <TabsTrigger value="myposts" className="shrink-0 h-9 px-3 text-xs sm:text-sm rounded-lg"><MessageSquare className="w-4 h-4 mr-1.5" /> โพสต์ของฉัน</TabsTrigger>
            <TabsTrigger value="card" className="shrink-0 h-9 px-3 text-xs sm:text-sm rounded-lg"><IdCard className="w-4 h-4 mr-1.5" /> บัตรประจำตัว</TabsTrigger>
          </TabsList>
        </div>

        {/* Personal Info */}
        <TabsContent value="info">
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6 space-y-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> ข้อมูลส่วนตัว
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="ชื่อ" icon={<User className="w-4 h-4" />} value={profile.first_name || ""} editing={editing} onChange={v => update("first_name", v)} />
                <Field label="นามสกุล" icon={<User className="w-4 h-4" />} value={profile.last_name || ""} editing={editing} onChange={v => update("last_name", v)} />
                <Field label="ชื่อเล่น" icon={<Heart className="w-4 h-4" />} value={profile.nickname || ""} editing={editing} onChange={v => update("nickname", v)} />
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> วันเกิด</Label>
                  {editing ? (
                    <BEDatePicker value={profile.date_of_birth || ""} onChange={(v) => update("date_of_birth", v)} />
                  ) : (
                    <p className="text-sm text-foreground py-2 px-3 bg-muted/30 rounded-lg">{formatDateBE(profile.date_of_birth) || "—"}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3.5 h-3.5" /> เพศ</Label>
                  {editing ? (
                    <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={profile.gender || ""} onChange={e => update("gender", e.target.value)}>
                      <option value="">ไม่ระบุ</option>
                      <option value="ช">ชาย</option>
                      <option value="ญ">หญิง</option>
                    </select>
                  ) : (
                    <p className="text-sm text-foreground py-2 px-3 bg-muted/30 rounded-lg">{profile.gender === "ช" || profile.gender === "male" || profile.gender === "ชาย" ? "ชาย" : profile.gender === "ญ" || profile.gender === "female" || profile.gender === "หญิง" ? "หญิง" : "—"}</p>
                  )}
                </div>
                <Field label="หมู่เลือด" icon={<Droplets className="w-4 h-4" />} value={profile.blood_type || ""} editing={editing} onChange={v => update("blood_type", v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> แนะนำตัว (Bio)</Label>
                {editing ? (
                  <Textarea value={profile.bio || ""} onChange={e => update("bio", e.target.value)} placeholder="เขียนแนะนำตัวสั้นๆ..." className="min-h-[80px]" />
                ) : (
                  <p className="text-sm text-foreground py-2 px-3 bg-muted/30 rounded-lg min-h-[40px]">{profile.bio || "—"}</p>
                )}
              </div>
              <h3 className="font-semibold text-foreground flex items-center gap-2 pt-2">
                <Briefcase className="w-4 h-4 text-primary" /> ข้อมูลการทำงาน / การศึกษา
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="รหัสนักเรียน" icon={<GraduationCap className="w-4 h-4" />} value={profile.student_code || ""} editing={editing && (role === "admin" || role === "director")} onChange={v => update("student_code", v)} />

                {(role === "admin" || role === "director" || role === "teacher") && (
                  <Field label="รหัสบุคลากร" icon={<Briefcase className="w-4 h-4" />} value={profile.employee_code || ""} editing={editing && (role === "admin" || role === "director")} onChange={v => update("employee_code", v)} />
                )}
                {(role === "admin" || role === "director" || role === "teacher") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" /> ตำแหน่ง
                    </Label>
                    {editing ? (
                      <Select value={profile.position_title || ""} onValueChange={v => update("position_title", v)}>
                        <SelectTrigger><SelectValue placeholder="เลือกตำแหน่ง" /></SelectTrigger>
                        <SelectContent>
                          {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-foreground py-2 px-3 bg-muted/30 rounded-lg">{profile.position_title || "—"}</p>
                    )}
                  </div>
                )}
                {(role === "admin" || role === "director" || role === "teacher") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" /> ฝ่ายงาน
                    </Label>
                    {editing ? (
                      <Select value={profile.department || ""} onValueChange={v => update("department", v)}>
                        <SelectTrigger><SelectValue placeholder="เลือกฝ่ายงาน" /></SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-foreground py-2 px-3 bg-muted/30 rounded-lg">{profile.department || "—"}</p>
                    )}
                  </div>
                )}
                {(role === "teacher" || role === "director" || role === "admin") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" /> หมวดวิชา / กลุ่มสาระ
                    </Label>
                    {editing ? (
                      <Select value={subjectGroup} onValueChange={setSubjectGroup}>
                        <SelectTrigger><SelectValue placeholder="เลือกหมวดวิชา" /></SelectTrigger>
                        <SelectContent>
                          {SUBJECT_GROUPS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-foreground py-2 px-3 bg-muted/30 rounded-lg">{subjectGroup || "—"}</p>
                    )}
                  </div>
                )}
              </div>

              {(role === "teacher" || role === "director" || role === "admin") && (
                <div className="pt-2">
                  <MyMembershipsCard />
                </div>
              )}


              {/* PDPA consent status */}
              <div className="pt-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-primary" /> {lang === "th" ? "ความยินยอม PDPA" : "PDPA Consent"}
                </h3>
                <PdpaConsentCard acceptedAt={profile.pdpa_accepted_at} version={profile.pdpa_version} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact */}
        <TabsContent value="contact">
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6 space-y-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" /> ข้อมูลการติดต่อ
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> อีเมล</Label>
                  <p className="text-sm text-foreground py-2 px-3 bg-muted/30 rounded-lg">{userEmail || "—"}</p>
                </div>
                <Field label="เบอร์โทร" icon={<Phone className="w-4 h-4" />} value={profile.phone || ""} editing={editing} onChange={v => update("phone", v)} />
                <Field label="LINE ID" icon={<MessageCircle className="w-4 h-4" />} value={profile.line_id || ""} editing={editing} onChange={v => update("line_id", v)} />
                <Field label="Facebook" icon={<Facebook className="w-4 h-4" />} value={profile.facebook_url || ""} editing={editing} onChange={v => update("facebook_url", v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> ที่อยู่</Label>
                {editing ? (
                  <Textarea value={profile.address || ""} onChange={e => update("address", e.target.value)} className="min-h-[80px]" />
                ) : (
                  <p className="text-sm text-foreground py-2 px-3 bg-muted/30 rounded-lg min-h-[40px]">{profile.address || "—"}</p>
                )}
              </div>
              <h3 className="font-semibold text-foreground flex items-center gap-2 pt-2">
                <Shield className="w-4 h-4 text-destructive" /> ผู้ติดต่อฉุกเฉิน
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="ชื่อผู้ติดต่อฉุกเฉิน" icon={<User className="w-4 h-4" />} value={profile.emergency_contact || ""} editing={editing} onChange={v => update("emergency_contact", v)} />
                <Field label="เบอร์ฉุกเฉิน" icon={<Phone className="w-4 h-4" />} value={profile.emergency_phone || ""} editing={editing} onChange={v => update("emergency_phone", v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teacher: Teaching load */}
        {role === "teacher" && (
          <TabsContent value="teaching">
            <div className="space-y-4">
              {/* Homeroom */}
              {teacherHomeroom && teacherHomeroom.length > 0 && (
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" /> ครูประจำชั้น
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {teacherHomeroom.map((c: any) => (
                        <Badge key={c.id} variant="outline" className="text-sm px-3 py-1.5">
                          {c.name} ({c.grade_level})
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Subjects taught */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> วิชาที่สอน
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {teacherAssignments && teacherAssignments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>รหัสวิชา</TableHead>
                          <TableHead>ชื่อวิชา</TableHead>
                          <TableHead>ห้องเรียน</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teacherAssignments.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-mono text-sm">{a.subjects?.code}</TableCell>
                            <TableCell>{a.subjects?.name_th}</TableCell>
                            <TableCell>{a.classrooms?.name || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีวิชาที่ได้รับมอบหมาย</p>
                  )}
                </CardContent>
              </Card>

              {/* Schedule */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> ตารางสอน
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {teacherSchedules && teacherSchedules.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>วัน</TableHead>
                          <TableHead>คาบ</TableHead>
                          <TableHead>เวลา</TableHead>
                          <TableHead>วิชา</TableHead>
                          <TableHead>ห้อง</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teacherSchedules.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell>{dayNames[s.day_of_week] || s.day_of_week}</TableCell>
                            <TableCell className="text-center">{s.period}</TableCell>
                            <TableCell className="text-xs">{s.start_time || ""} - {s.end_time || ""}</TableCell>
                            <TableCell>{s.subjects?.name_th || "—"}</TableCell>
                            <TableCell>{s.classrooms?.name || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีตารางสอน</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Student: Academic */}
        {role === "student" && (
          <TabsContent value="academic">
            <div className="space-y-4">
              {/* Classroom info */}
              {studentRecord && (
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" /> ข้อมูลห้องเรียน
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground">ระดับชั้น</p>
                        <p className="text-lg font-bold text-foreground">{(studentRecord as any).classrooms?.grade_level || "—"}</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground">ห้อง</p>
                        <p className="text-lg font-bold text-foreground">{(studentRecord as any).classrooms?.name || "—"}</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground">ครูประจำชั้น</p>
                        <p className="text-lg font-bold text-foreground">{[(studentRecord as any).classrooms?.homeroom_teacher, (studentRecord as any).classrooms?.homeroom_teacher_2].filter(Boolean).join(", ") || "—"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Schedule */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> ตารางเรียน
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {studentSchedules && studentSchedules.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>วัน</TableHead>
                          <TableHead>คาบ</TableHead>
                          <TableHead>เวลา</TableHead>
                          <TableHead>วิชา</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentSchedules.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell>{dayNames[s.day_of_week] || s.day_of_week}</TableCell>
                            <TableCell className="text-center">{s.period}</TableCell>
                            <TableCell className="text-xs">{s.start_time || ""} - {s.end_time || ""}</TableCell>
                            <TableCell>{s.subjects?.name_th || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีตารางเรียน</p>
                  )}
                </CardContent>
              </Card>

              {/* Grades */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> ผลการเรียน
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {studentScores && studentScores.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>รหัสวิชา</TableHead>
                          <TableHead>ชื่อวิชา</TableHead>
                          <TableHead>คะแนนรวม</TableHead>
                          <TableHead>เกรด</TableHead>
                          <TableHead>ปีการศึกษา</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentScores.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-sm">{s.subjects?.code}</TableCell>
                            <TableCell>{s.subjects?.name_th}</TableCell>
                            <TableCell className="text-center">{s.total_score ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-bold">{s.grade || "—"}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{s.academic_year || "—"}/{s.semester}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีผลการเรียน</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Student: Teachers */}
        {role === "student" && (
          <TabsContent value="teachers">
            <div className="space-y-4">
              {/* Homeroom Teacher */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" /> ครูประจำชั้น
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {homeroomTeacherProfiles && homeroomTeacherProfiles.length > 0 ? (
                    <div className="space-y-3">
                      {homeroomTeacherProfiles.map((t: any) => (
                        <div key={t.id} className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl">
                          <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg font-bold text-primary">
                              {(t.first_name?.[0] || "") + (t.last_name?.[0] || "")}
                            </span>
                          </div>
                          <div className="flex-1 space-y-1">
                            <h4 className="font-semibold text-foreground text-lg">
                              {t.prefix || ""}{t.first_name} {t.last_name}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="text-xs">{t.position || "ครู"}</Badge>
                              {t.department && (
                                <Badge variant="secondary" className="text-xs">{t.department}</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
                              {t.phone && (
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {t.phone}</span>
                              )}
                              {t.email && (
                                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {t.email}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {[(studentRecord as any)?.classrooms?.homeroom_teacher, (studentRecord as any)?.classrooms?.homeroom_teacher_2].filter(Boolean).join(", ") || "ยังไม่มีข้อมูลครูประจำชั้น"}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Subject Teachers */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> ครูประจำวิชา
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {studentTeachers && studentTeachers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {studentTeachers.map((teacher: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border border-border/50 hover:border-primary/30 transition-colors">
                          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-primary">
                              {(teacher.first_name?.[0] || "") + (teacher.last_name?.[0] || "")}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground text-sm truncate">
                              {teacher.prefix || ""}{teacher.first_name} {teacher.last_name}
                            </h4>
                            <p className="text-xs text-muted-foreground">{teacher.position || "ครู"}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {teacher.subjects?.map((sub: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                                  {sub.name_th}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-1.5">
                              {teacher.phone && (
                                <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" /> {teacher.phone}</span>
                              )}
                              {teacher.email && (
                                <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" /> {teacher.email}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีข้อมูลครูประจำวิชา</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Director: Overview Dashboard */}
        {(role === "director" || role === "admin") && (
          <TabsContent value="overview">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { icon: Users, label: "นักเรียน", value: directorStats?.students || 0, color: "from-blue-500 to-blue-600" },
                  { icon: Briefcase, label: "บุคลากร", value: directorStats?.personnel || 0, color: "from-emerald-500 to-emerald-600" },
                  { icon: Building, label: "ห้องเรียน", value: directorStats?.classrooms || 0, color: "from-purple-500 to-purple-600" },
                  { icon: BookOpen, label: "รายวิชา", value: directorStats?.subjects || 0, color: "from-orange-500 to-orange-600" },
                  { icon: ClipboardList, label: "อัตราเข้าเรียน", value: `${directorStats?.attendanceRate || 0}%`, color: "from-rose-500 to-rose-600" },
                ].map((item, i) => (
                  <Card key={i} className="border-0 shadow-lg overflow-hidden">
                    <div className={`bg-gradient-to-br ${item.color} p-4 text-white`}>
                      <item.icon className="w-6 h-6 mb-2 opacity-80" />
                      <p className="text-2xl font-bold">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</p>
                      <p className="text-xs opacity-80">{item.label}</p>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" /> สรุปภาพรวม
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">จำนวนนักเรียนทั้งหมด</span>
                      <span className="font-bold text-foreground">{directorStats?.students || 0} คน</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">จำนวนบุคลากร</span>
                      <span className="font-bold text-foreground">{directorStats?.personnel || 0} คน</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">ห้องเรียนทั้งหมด</span>
                      <span className="font-bold text-foreground">{directorStats?.classrooms || 0} ห้อง</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">รายวิชาที่เปิดสอน</span>
                      <span className="font-bold text-foreground">{directorStats?.subjects || 0} วิชา</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" /> ตัวชี้วัดสำคัญ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">อัตราการเข้าเรียน</span>
                        <span className="font-bold text-foreground">{directorStats?.attendanceRate || 0}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                          style={{ width: `${directorStats?.attendanceRate || 0}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">สัดส่วนครู : นักเรียน</span>
                        <span className="font-bold text-foreground">
                          1 : {directorStats?.personnel && directorStats.personnel > 0 ? Math.round((directorStats?.students || 0) / directorStats.personnel) : "—"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        )}

        {/* My Documents */}
        <TabsContent value="documents">
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-primary" /> เอกสารที่ส่งถึงฉัน
                {myDocuments.filter((d: any) => !d._isRead).length > 0 && (
                  <Badge variant="destructive" className="text-xs">{myDocuments.filter((d: any) => !d._isRead).length} ใหม่</Badge>
                )}
              </h3>
              {myDocuments.length > 0 ? (
                <div className="space-y-3">
                  {myDocuments.map((doc: any) => (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        doc._isRead ? "bg-muted/20 border-border/50" : "bg-primary/5 border-primary/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {!doc._isRead && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                            <h4 className="font-semibold text-foreground text-sm truncate">{doc.title}</h4>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{doc.doc_number}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {doc.doc_type === "incoming" ? "หนังสือรับ" : doc.doc_type === "outgoing" ? "หนังสือส่ง" : "ภายใน"}
                            </Badge>
                            {doc.from_department && <span>จาก: {doc.from_department}</span>}
                            <span>{doc.doc_date}</span>
                          </div>
                          {doc.notes && <p className="text-xs text-muted-foreground mt-1.5">{doc.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={
                            doc.status === "completed" ? "bg-green-100 text-green-800" :
                            doc.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                            "bg-yellow-100 text-yellow-800"
                          }>
                            {doc.status === "completed" ? "เสร็จสิ้น" : doc.status === "in_progress" ? "ดำเนินการ" : "รอดำเนินการ"}
                          </Badge>
                          {!doc._isRead && doc._recipientId && (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => markDocRead(doc._recipientId)}>
                              <Eye className="w-3 h-3 mr-1" /> อ่านแล้ว
                            </Button>
                          )}
                          {doc._isRead && <FileCheck className="w-4 h-4 text-green-600" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">ยังไม่มีเอกสารที่ส่งถึงคุณ</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Posts — wall_posts authored by this user */}
        <TabsContent value="myposts">
          {userId && <MyPostsTab userId={userId} />}
        </TabsContent>



        {/* SDQ Assessment Link for Students */}
        {role === "student" && (
          <TabsContent value="sdq">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5" /> แบบประเมิน SDQ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  แชร์ลิงก์ด้านล่างให้ผู้ปกครองเพื่อกรอกแบบประเมิน SDQ หรือสแกน QR Code จากบัตรนักเรียน
                </p>
                {studentRecord?.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input readOnly value={`${window.location.origin}/sdq-assess/${studentRecord.id}`} className="font-mono text-xs" />
                      <Button variant="outline" size="sm" onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/sdq-assess/${studentRecord.id}`);
                        toast.success("คัดลอกลิงก์แล้ว");
                      }}>คัดลอก</Button>
                    </div>
                    <div className="flex justify-center p-4 bg-muted rounded-lg">
                      <QRCodeSVG value={`${window.location.origin}/sdq-assess/${studentRecord.id}`} size={180} />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">QR Code สำหรับผู้ปกครองสแกนเพื่อประเมิน SDQ</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">ไม่พบข้อมูลนักเรียน กรุณาตรวจสอบรหัสนักเรียนในข้อมูลส่วนตัว</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Student Tasks */}
        {role === "student" && (
          <TabsContent value="tasks">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ListTodo className="w-5 h-5" /> การบ้านและภาระงานทุกวิชา</CardTitle>
              </CardHeader>
              <CardContent>
                {studentTasks.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">ยังไม่มีภาระงาน</p>
                ) : (
                  <div className="space-y-3">
                    {studentTasks.map((task: any) => (
                      <div key={task.id} className="flex items-start gap-3 p-4 rounded-xl border bg-card hover:bg-muted/30 transition">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {task.subjects && (
                              <Badge className="bg-primary/10 text-primary border-0 text-[10px]">
                                <BookOpen className="w-3 h-3 mr-1" />
                                {(task.subjects as any).name_th || (task.subjects as any).code}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-[10px]">
                              {task.task_type === "homework" ? "การบ้าน" : task.task_type === "duty" ? "เวร" : "งานมอบหมาย"}
                            </Badge>
                            <Badge className={`border-0 text-[10px] ${
                              task.status === "completed" ? "bg-success/10 text-success" :
                              task.status === "in_progress" ? "bg-primary/10 text-primary" :
                              task.status === "overdue" ? "bg-destructive/10 text-destructive" :
                              "bg-warning/10 text-warning"
                            }`}>
                              {task.status === "completed" ? <><CheckCircle2 className="w-3 h-3 mr-1" />เสร็จสิ้น</> :
                               task.status === "in_progress" ? <><Clock className="w-3 h-3 mr-1" />กำลังทำ</> :
                               task.status === "overdue" ? <><AlertTriangle className="w-3 h-3 mr-1" />เลยกำหนด</> :
                               <><Clock className="w-3 h-3 mr-1" />รอดำเนินการ</>}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{task.title}</p>
                          {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                          <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
                            <span>📅 สั่งเมื่อ: {new Date(task.assigned_date).toLocaleDateString("th-TH")}</span>
                            {task.due_date && <span>⏰ กำหนดส่ง: {new Date(task.due_date).toLocaleDateString("th-TH")}</span>}
                          </div>
                        </div>
                        {task.status !== "completed" && (
                          <div className="flex flex-col gap-1 shrink-0">
                            {task.status === "pending" && (
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateTaskStatus(task.id, "in_progress")}>
                                เริ่มทำ
                              </Button>
                            )}
                            <Button size="sm" className="text-xs h-7" onClick={() => updateTaskStatus(task.id, "completed")}>
                              ส่งแล้ว
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ID Card */}
        <TabsContent value="card">
          <div className="flex justify-end mb-4">
            <Button onClick={handlePrintIdCard} className="gap-2">
              <Download className="w-4 h-4" /> พิมพ์บัตรเป็น PDF
            </Button>
          </div>
          <div className="flex flex-col items-center gap-4 max-w-[380px] mx-auto">
            <IdCardFront
              id="id-card-front"
              width={360}
              cs={cs}
              person={{
                name: fullName,
                code: profile.student_code || profile.employee_code || "",
                className: role === "student" ? ((studentRecord as any)?.classrooms?.name || "") : undefined,
                positionTitle: profile.position_title || undefined,
                avatarUrl: profile.avatar_url || undefined,
                dateOfBirth: profile.date_of_birth || undefined,
                bloodType: profile.blood_type || undefined,
                qrValue: profile.student_code || profile.employee_code || profileUrl,
              }}
            />
            <p className="text-center text-xs text-muted-foreground">ด้านหน้า</p>

            <IdCardBack
              id="id-card-back"
              width={360}
              cs={cs}
              person={{
                name: fullName,
                code: profile.student_code || profile.employee_code || "",
                emergencyContact: profile.emergency_contact || undefined,
                emergencyPhone: profile.emergency_phone || undefined,
                phone: profile.phone || undefined,
              }}
            />
            <p className="text-center text-xs text-muted-foreground">ด้านหลัง</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Field = ({ label, icon, value, editing, onChange }: {
  label: string; icon: React.ReactNode; value: string; editing: boolean; onChange: (v: string) => void;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground flex items-center gap-1">{icon} {label}</Label>
    {editing ? (
      <Input value={value} onChange={e => onChange(e.target.value)} />
    ) : (
      <p className="text-sm text-foreground py-2 px-3 bg-muted/30 rounded-lg">{value || "—"}</p>
    )}
  </div>
);

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    {icon}
    <div>
      {label && <span className="text-muted-foreground">{label}: </span>}
      <span className="text-foreground">{value}</span>
    </div>
  </div>
);

export default ProfilePage;
