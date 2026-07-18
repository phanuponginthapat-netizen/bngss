import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Shield, Trash2, Download, Users, UserPlus, FileSpreadsheet, Upload, Pencil, RefreshCw, Eraser, GraduationCap, Settings, MoreHorizontal, Wrench, ScanFace, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import FaceRegisterDialog from "@/components/users/FaceRegisterDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { swal } from "@/lib/swal";
import { z } from "zod";
import { validateAndConfirm } from "@/lib/formValidation";
import {
  GRADE_LEVELS, DEPARTMENTS, POSITIONS, ACADEMIC_STANDINGS, SUBJECT_GROUPS,
  PREFIXES_STUDENT, PREFIXES_STAFF, DMC_STUDENT_MAP,
  userCreateSchema, userEditSchema, userLabels,
} from "@/lib/dmcImport";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useUserRole";
import * as XLSX from "xlsx";
import DepartmentManagementPage from "@/pages/admin/DepartmentManagementPage";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { formatDateBE , todayBangkok } from "@/lib/dateBE";
import { SPECIAL_NEEDS_TYPES } from "@/lib/specialNeeds";
import { matchAlias, STUDENT_ALIASES } from "@/lib/importHeaders";
import { useUserList, type UserItem } from "@/hooks/useUserList";





const UserManagement = () => {
  const { t, lang } = useLanguage();
  const {
    users, setUsers,
    loading,
    fetchUsers,
    search, setSearch,
    filterRole, setFilterRole,
    filterGrade, setFilterGrade,
    filteredUsers,
    selectedIds, setSelectedIds,
    toggleSelect, toggleSelectAll,
  } = useUserList();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoConvertBE, setAutoConvertBE] = useState(true);


  // Add form state
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("School@1234");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formRole, setFormRole] = useState<AppRole>("teacher");
  const [formDept, setFormDept] = useState("วิชาการ");
  const [formStudentCode, setFormStudentCode] = useState("");
  const [formGradeLevel, setFormGradeLevel] = useState("");
  const [formPrefix, setFormPrefix] = useState("ด.ช.");
  const [formNationalId, setFormNationalId] = useState("");
  const [formPosition, setFormPosition] = useState("ครู");
  const [formAcademicStanding, setFormAcademicStanding] = useState("ไม่มี");
  const [formSubjectGroup, setFormSubjectGroup] = useState("");
  const [formGender, setFormGender] = useState("");
  const [formDateOfBirth, setFormDateOfBirth] = useState("");
  const [formPhone, setFormPhone] = useState("");

  // Edit form state — comprehensive for admin central control
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editClassrooms, setEditClassrooms] = useState<any[]>([]);
  const [editNewPassword, setEditNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [faceRegisterUser, setFaceRegisterUser] = useState<UserItem | null>(null);
  const setF = (k: string, v: any) => setEditForm((p: any) => ({ ...p, [k]: v }));

  const [bulkUsers, setBulkUsers] = useState<any[]>([]);
  const [bulkPreview, setBulkPreview] = useState(false);
  const [importResults, setImportResults] = useState<any[] | null>(null);
  const [importSummaryOpen, setImportSummaryOpen] = useState(false);
  const [bulkImportType, setBulkImportType] = useState<"student" | "teacher">("student");
  const [graduating, setGraduating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deletingByRole, setDeletingByRole] = useState<string | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<{ open: boolean; current: number; total: number; failed: number; label: string; done: boolean }>({ open: false, current: 0, total: 0, failed: 0, label: "", done: false });
  const [graduateOpen, setGraduateOpen] = useState(false);
  const [deleteStudentsOpen, setDeleteStudentsOpen] = useState(false);
  const [deleteTeachersOpen, setDeleteTeachersOpen] = useState(false);
  const queryClient = useQueryClient();

  // School settings
  const { data: schoolSettings = [] } = useQuery({
    queryKey: ["school_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("school_settings").select("*");
      return data || [];
    },
  });
  const getSetting = (key: string) => schoolSettings.find((s: any) => s.setting_key === key)?.setting_value || "";
  const [settingGradeStart, setSettingGradeStart] = useState("");
  const [settingGradeEnd, setSettingGradeEnd] = useState("");
  const [settingTerminalGrades, setSettingTerminalGrades] = useState<string[]>([]);
  const [settingEmailDomain, setSettingEmailDomain] = useState("@bng.ac.th");

  useEffect(() => {
    if (schoolSettings.length > 0) {
      setSettingGradeStart(getSetting("grade_range_start") || "ป.1");
      setSettingGradeEnd(getSetting("grade_range_end") || "ม.6");
      setSettingEmailDomain(getSetting("email_domain") || "@bng.ac.th");
      try {
        setSettingTerminalGrades(JSON.parse(getSetting("terminal_grades") || '["ป.6","ม.3","ม.6"]'));
      } catch { setSettingTerminalGrades(["ป.6", "ม.3", "ม.6"]); }
    }
  }, [schoolSettings]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const updates = [
        { setting_key: "grade_range_start", setting_value: settingGradeStart },
        { setting_key: "grade_range_end", setting_value: settingGradeEnd },
        { setting_key: "terminal_grades", setting_value: JSON.stringify(settingTerminalGrades) },
        { setting_key: "email_domain", setting_value: settingEmailDomain },
      ];
      for (const u of updates) {
        await supabase.from("school_settings").upsert(u, { onConflict: "setting_key" });
      }
      swal.toast.success("บันทึกการตั้งค่าเรียบร้อย");
      queryClient.invalidateQueries({ queryKey: ["school_settings"] });
      setSettingsOpen(false);
    } catch (e: any) {
      swal.error(e.message || "บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  };

  const handleGraduateTerminal = async () => {
    if (settingTerminalGrades.length === 0) {
      swal.error("ยังไม่ได้ตั้งค่าระดับชั้นที่จบ"); return;
    }
    setGraduating(true);
    try {
      // Get classrooms matching terminal grades
      const { data: termClassrooms } = await supabase
        .from("classrooms")
        .select("id, grade_level")
        .in("grade_level", settingTerminalGrades);

      if (!termClassrooms || termClassrooms.length === 0) {
        swal.toast.info("ไม่พบห้องเรียนที่ตรงกับระดับชั้นจบ");
        setGraduating(false);
        return;
      }

      const classroomIds = termClassrooms.map(c => c.id);
      
      // Get students in those classrooms
      const { data: studentsToGraduate } = await supabase
        .from("students")
        .select("id, student_code, classroom_id, classrooms!students_classroom_id_fkey(grade_level)")
        .in("classroom_id", classroomIds)
        .eq("status", "active");

      if (!studentsToGraduate || studentsToGraduate.length === 0) {
        swal.toast.info("ไม่พบนักเรียนที่ต้องจบการศึกษา");
        setGraduating(false);
        return;
      }

      // Calculate GPA for each student and update
      const currentYear = new Date().getFullYear();
      let count = 0;
      for (const st of studentsToGraduate) {
        // Get scores for GPA
        const { data: stScores } = await supabase
          .from("student_scores")
          .select("grade_point, subject_id")
          .eq("student_code", st.student_code);
        
        const { data: subs } = await supabase.from("subjects").select("id, credits");
        const subMap = new Map((subs || []).map(s => [s.id, s.credits || 0]));
        
        let totalWeighted = 0, totalCredits = 0;
        (stScores || []).forEach((sc: any) => {
          const credits = subMap.get(sc.subject_id) || 0;
          totalWeighted += (sc.grade_point || 0) * credits;
          totalCredits += credits;
        });
        const gpa = totalCredits > 0 ? Math.round((totalWeighted / totalCredits) * 100) / 100 : 0;
        const gradeLevel = (st as any).classrooms?.grade_level || "";

        await supabase.from("students").update({
          status: "graduated",
          graduated_at: todayBangkok(),
          graduation_year: currentYear,
          graduation_gpa: gpa,
          graduation_level: gradeLevel,
          classroom_id: null,
        }).eq("id", st.id);
        count++;
      }

      // Change role to alumni instead of deleting auth accounts
      const graduatedIds = studentsToGraduate.map(s => s.id);
      await supabase.functions.invoke("manage-users", {
        body: { action: "graduate_students", student_ids: graduatedIds },
      });

      swal.toast.success(`จบการศึกษาสำเร็จ ${count} คน — ย้ายบัญชีไปศิษย์เก่าเรียบร้อย`);
      fetchUsers();
      queryClient.invalidateQueries({ queryKey: ["alumni"] });
    } catch (e: any) {
      swal.error(e.message || "เกิดข้อผิดพลาด");
    }
    setGraduating(false);
  };




  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    setDeleteProgress({ open: true, current: 0, total: ids.length, failed: 0, label: `กำลังลบผู้ใช้ที่เลือก`, done: false });
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const userId = ids[i];
      try {
        const { data, error } = await supabase.functions.invoke("manage-users", {
          body: { action: "delete", user_id: userId },
        });
        if (error || data?.error) failCount++; else successCount++;
      } catch { failCount++; }
      setDeleteProgress((p) => ({ ...p, current: i + 1, failed: failCount }));
    }
    setDeleteProgress((p) => ({ ...p, done: true }));
    swal.toast.success(`ลบสำเร็จ ${successCount} คน${failCount > 0 ? `, ล้มเหลว ${failCount} คน` : ""}`);
    setSelectedIds(new Set());
    fetchUsers();
    setBulkDeleting(false);
  };

  const roleColors: Record<string, string> = {
    admin: "bg-destructive/10 text-destructive",
    teacher: "bg-primary/10 text-primary",
    student: "bg-accent/10 text-accent-foreground",
    director: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    alumni: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    parent: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };

  const handleAddUser = async () => {
    const { ok } = await validateAndConfirm(
      userCreateSchema,
      {
        email: formEmail,
        password: formPassword,
        first_name: formFirstName,
        last_name: formLastName,
        role: formRole,
        student_code: formRole === "student" ? formStudentCode : undefined,
        national_id: formNationalId || "",
        phone: formPhone || "",
      },
      {
        confirmTitle: "ยืนยันเพิ่มผู้ใช้?",
        confirmText: `${formPrefix || ""} ${formFirstName} ${formLastName} (${formRole})`.trim(),
        labels: userLabels,
      },
    );
    if (!ok) return;
    if (formRole === "student" && !formStudentCode) {
      swal.error("กรุณากรอกรหัสนักเรียน"); return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "create",
          email: formEmail, password: formPassword,
          first_name: formFirstName, last_name: formLastName,
          role: formRole,
          department: formRole === "student" ? formGradeLevel : formDept,
          student_code: formRole === "student" ? formStudentCode : undefined,
          grade_level: formRole === "student" ? formGradeLevel : undefined,
          prefix: formPrefix,
          national_id: formNationalId || undefined,
           position: formRole !== "student" ? formPosition : undefined,
           academic_standing: formRole !== "student" ? formAcademicStanding : undefined,
           subject_group: formRole !== "student" ? formSubjectGroup : undefined,
           gender: formGender || undefined,
           date_of_birth: formDateOfBirth || undefined,
           phone: formPhone || undefined,
         },
       });
      // Edge function ตอบ 400 พร้อม JSON {error} — ดึงข้อความจริงจาก body
      if (error) {
        let msg = error.message || "เพิ่มผู้ใช้ไม่สำเร็จ";
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          } else if (ctx?.text) {
            const t = await ctx.text();
            try { const j = JSON.parse(t); if (j?.error) msg = j.error; } catch { if (t) msg = t; }
          }
        } catch { /* ignore body parse */ }
        // แปลข้อความ auth ที่พบบ่อยเป็นภาษาไทย
        if (/already been registered|already exists/i.test(msg)) msg = "อีเมลนี้ถูกใช้งานแล้ว — กรุณาใช้อีเมลอื่น";
        else if (/password/i.test(msg) && /short|weak|6|character/i.test(msg)) msg = "รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัว)";
        else if (/invalid.*email/i.test(msg)) msg = "รูปแบบอีเมลไม่ถูกต้อง";
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      swal.toast.success("เพิ่มผู้ใช้สำเร็จ");
      setAddOpen(false); resetForm(); fetchUsers();
    } catch (e: any) {
      swal.error(e.message || "เพิ่มผู้ใช้ไม่สำเร็จ");
    }
    setSaving(false);
  };

  const handleEditUser = async () => {
    if (!editUser) return;
    const f = editForm;
    const { ok } = await validateAndConfirm(
      userEditSchema,
      {
        first_name: f.first_name,
        last_name: f.last_name,
        email: f.email || "",
        phone: f.phone || "",
        national_id: f.national_id || "",
        emergency_phone: f.emergency_phone || "",
      },
      {
        confirmTitle: "ยืนยันบันทึกการแก้ไข?",
        confirmText: `${f.first_name} ${f.last_name}`,
        labels: userLabels,
      },
    );
    if (!ok) return;
    setSaving(true);
    try {
      // Build comprehensive payload — only send fields the user can see / edit
      const payload: any = {
        action: "update",
        user_id: editUser.id,
        // account
        first_name: f.first_name,
        last_name: f.last_name,
        role: f.role,
        department: f.department,
        prefix: f.prefix,
        email: f.email && f.email !== editUser.email ? f.email : undefined,
        is_approved: f.is_approved,
        // identifiers
        employee_code: f.employee_code,
        student_code: f.student_code,
        // profile / personal
        nickname: f.nickname,
        phone: f.phone,
        gender: f.gender,
        date_of_birth: f.date_of_birth,
        address: f.address,
        line_id: f.line_id,
        facebook_url: f.facebook_url,
        emergency_contact: f.emergency_contact,
        emergency_phone: f.emergency_phone,
        blood_type: f.blood_type,
        bio: f.bio,
      };
      if (f.role !== "student") {
        payload.position = f.position;
        payload.academic_standing = f.academic_standing;
        payload.subject_group = f.subject_group;
        payload.hire_date = f.hire_date;
      }
      if (f.role === "student") {
        // Student / DMC fields
        Object.assign(payload, {
          national_id: f.national_id,
          grade_level: f.grade_level,
          classroom_id: f.classroom_id,
          nationality: f.nationality,
          ethnicity: f.ethnicity,
          religion: f.religion,
          weight: f.weight,
          height: f.height,
          birth_province: f.birth_province,
          special_needs: f.special_needs,
          is_special_needs: !!f.is_special_needs,
          special_needs_type: f.is_special_needs ? (f.special_needs_type || null) : null,
          inclusion_classroom_id: f.is_special_needs ? (f.inclusion_classroom_id || null) : null,
          previous_school: f.previous_school,
          admission_date: f.admission_date,
          father_name: f.father_name,
          father_phone: f.father_phone,
          father_id: f.father_id,
          father_occupation: f.father_occupation,
          mother_name: f.mother_name,
          mother_phone: f.mother_phone,
          mother_id: f.mother_id,
          mother_occupation: f.mother_occupation,
          guardian_name: f.guardian_name,
          guardian_phone: f.guardian_phone,
          guardian_relation: f.guardian_relation,
          student_status: f.student_status,
        });
      }
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      swal.toast.success("แก้ไขผู้ใช้สำเร็จ");
      setEditOpen(false); setEditUser(null); fetchUsers();
    } catch (e: any) {
      swal.error(e.message || "Failed to update user");
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!editUser || !editNewPassword) return;
    if (editNewPassword.length < 6) {
      swal.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "reset_password", user_id: editUser.id, new_password: editNewPassword },
      });
      if (error) {
        let detail = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.body) {
            const text = typeof ctx.body === "string" ? ctx.body : await new Response(ctx.body).text();
            const parsed = JSON.parse(text);
            if (parsed?.error) detail = parsed.error;
          }
        } catch {}
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      swal.toast.success("รีเซ็ตรหัสผ่านสำเร็จ");
      setEditNewPassword("");
    } catch (e: any) {
      swal.error(e.message || "Failed to reset password");
    }
    setResettingPassword(false);
  };

  const openEditDialog = async (user: UserItem) => {
    setEditUser(user);
    setEditNewPassword("");
    // Pre-fill with row data immediately to avoid blank form
    setEditForm({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      prefix: user.prefix || "",
      department: user.department || "",
      position: user.position_title || "",
      academic_standing: user.academic_standing || "",
      subject_group: user.subject_group || "",
      employee_code: user.employee_code || "",
      student_code: user.student_code || "",
      grade_level: user.grade_level || (user.role === "student" ? user.department : "") || "",
      classroom_id: user.classroom_id || null,
      phone: user.phone || "",
      gender: user.gender || "",
      date_of_birth: user.date_of_birth || "",
      nickname: user.nickname || "",
      is_approved: user.is_approved,
      student_status: user.student_status || "active",
    });
    setEditOpen(true);
    setEditLoading(true);
    try {
      // Fetch full record (profile + personnel + student) to get all DMC fields
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "get_full", user_id: user.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const p = data.profile || {};
      const per = data.personnel || {};
      const stu = data.student || {};
      const cls = data.classroom || {};
      setEditForm((prev: any) => ({
        ...prev,
        email: data.user?.email || prev.email,
        // profile
        nickname: p.nickname ?? prev.nickname ?? "",
        bio: p.bio ?? "",
        phone: p.phone ?? prev.phone ?? "",
        gender: p.gender ?? stu.gender ?? prev.gender ?? "",
        date_of_birth: p.date_of_birth ?? stu.date_of_birth ?? prev.date_of_birth ?? "",
        address: p.address ?? stu.address ?? "",
        line_id: p.line_id ?? "",
        facebook_url: p.facebook_url ?? "",
        blood_type: p.blood_type ?? stu.blood_type ?? "",
        emergency_contact: p.emergency_contact ?? stu.emergency_contact ?? "",
        emergency_phone: p.emergency_phone ?? stu.emergency_phone ?? "",
        is_approved: p.is_approved ?? prev.is_approved,
        // codes
        employee_code: p.employee_code ?? per.employee_code ?? prev.employee_code ?? "",
        student_code: p.student_code ?? stu.student_code ?? prev.student_code ?? "",
        // personnel
        prefix: per.prefix ?? stu.prefix ?? prev.prefix ?? "",
        position: per.position ?? p.position_title ?? prev.position ?? "",
        academic_standing: per.academic_standing ?? prev.academic_standing ?? "",
        subject_group: per.subject_group ?? prev.subject_group ?? "",
        department: per.department ?? p.department ?? prev.department ?? "",
        hire_date: per.hire_date ?? "",
        // student / DMC
        national_id: stu.national_id ?? "",
        nationality: stu.nationality ?? "",
        ethnicity: stu.ethnicity ?? "",
        religion: stu.religion ?? "",
        weight: stu.weight ?? "",
        height: stu.height ?? "",
        birth_province: stu.birth_province ?? "",
        special_needs: stu.special_needs ?? "",
        is_special_needs: !!stu.is_special_needs,
        special_needs_type: stu.special_needs_type ?? "",
        inclusion_classroom_id: stu.inclusion_classroom_id ?? null,
        previous_school: stu.previous_school ?? "",
        admission_date: stu.admission_date ?? "",
        father_name: stu.father_name ?? "",
        father_phone: stu.father_phone ?? "",
        father_id: stu.father_id ?? "",
        father_occupation: stu.father_occupation ?? "",
        mother_name: stu.mother_name ?? "",
        mother_phone: stu.mother_phone ?? "",
        mother_id: stu.mother_id ?? "",
        mother_occupation: stu.mother_occupation ?? "",
        guardian_name: stu.guardian_name ?? "",
        guardian_phone: stu.guardian_phone ?? "",
        guardian_relation: stu.guardian_relation ?? "",
        student_status: stu.status ?? prev.student_status ?? "active",
        grade_level: cls.grade_level ?? prev.grade_level ?? "",
        classroom_id: stu.classroom_id ?? prev.classroom_id ?? null,
      }));
      // Load classrooms for the selector
      const { data: cls2 } = await supabase.from("classrooms").select("id, name, grade_level").order("grade_level").order("name");
      setEditClassrooms(cls2 || []);
    } catch (e: any) {
      swal.error("โหลดข้อมูลเต็มไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      swal.toast.success("ลบผู้ใช้สำเร็จ");
      setUsers(users.filter((u) => u.id !== userId));
    } catch (e: any) {
      swal.error(e.message || "Failed to delete user");
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "update_role", user_id: userId, role: newRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      swal.toast.success(`เปลี่ยน Role เป็น ${t(`role.${newRole}`)} สำเร็จ`);
      await fetchUsers();
    } catch (e: any) {
      swal.error(e.message || "Failed to update role");
    }
  };
  const handleApproveUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "approve", user_id: userId, approved: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      swal.toast.success("อนุมัติผู้ใช้สำเร็จ");
      await fetchUsers();
    } catch (e: any) {
      swal.error(e.message || "Failed to approve user");
    }
  };

  const handleSyncPersonnel = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "sync_personnel" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      swal.toast.success(`ซิงค์ข้อมูลบุคลากรสำเร็จ (${data.synced} คน)`);
      await fetchUsers();
    } catch (e: any) {
      swal.error(e.message || "Sync failed");
    }
    setSyncing(false);
  };

  const handleCleanupOrphaned = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "cleanup_orphaned" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const cleaned = data.cleaned || {};
      swal.toast.success(`ล้างข้อมูลค้างสำเร็จ: นักเรียน ${cleaned.students || 0} คน, บุคลากร ${cleaned.personnel || 0} คน`);
      fetchUsers();
    } catch (e: any) {
      swal.error(e.message || "Cleanup failed");
    }
    setSyncing(false);
  };

  const handleDeleteByRole = async (targetRole: string) => {
    setDeletingByRole(targetRole);
    const roleLabel = targetRole === "student" ? "นักเรียน" : "ครู/ผอ.";
    // Determine target user IDs from already-loaded users (exclude self)
    const { data: { user: me } } = await supabase.auth.getUser();
    const targetIds = users
      .filter((u) => {
        if (targetRole === "student") return u.role === "student";
        if (targetRole === "teacher") return u.role === "teacher" || u.role === "director";
        return u.role === targetRole;
      })
      .map((u) => u.id)
      .filter((id) => id !== me?.id);

    if (targetIds.length === 0) {
      swal.toast.success(`ไม่พบ${roleLabel}ที่จะลบ`);
      setDeletingByRole(null);
      return;
    }

    setDeleteProgress({ open: true, current: 0, total: targetIds.length, failed: 0, label: `กำลังลบ${roleLabel}ทั้งหมด`, done: false });
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < targetIds.length; i++) {
      try {
        const { data, error } = await supabase.functions.invoke("manage-users", {
          body: { action: "delete", user_id: targetIds[i] },
        });
        if (error || data?.error) failCount++; else successCount++;
      } catch { failCount++; }
      setDeleteProgress((p) => ({ ...p, current: i + 1, failed: failCount }));
    }
    setDeleteProgress((p) => ({ ...p, done: true }));
    swal.toast.success(`ลบ${roleLabel}สำเร็จ ${successCount} คน${failCount > 0 ? `, ล้มเหลว ${failCount} คน` : ""}`);
    fetchUsers();
    queryClient.invalidateQueries({ queryKey: ["students"] });
    queryClient.invalidateQueries({ queryKey: ["personnel"] });
    setDeletingByRole(null);
  };

  const resetForm = () => {
    setFormEmail(""); setFormPassword("School@1234");
    setFormFirstName(""); setFormLastName("");
    setFormRole("teacher"); setFormDept("วิชาการ");
    setFormStudentCode(""); setFormGradeLevel(""); setFormPrefix("ด.ช.");
    setFormNationalId(""); setFormPosition("ครู"); setFormAcademicStanding("ไม่มี");
    setFormGender(""); setFormDateOfBirth(""); setFormPhone(""); setFormSubjectGroup("");
  };

  const parseDMCFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        let rows: any[] = [];

        // Header keywords used to detect the real header row (DMC exports often
        // start with a title row like "วันและเวลาที่สร้างรายงาน ...").
        const HEADER_HINTS = [
          "เลขประจำตัวนักเรียน", "รหัสโรงเรียน", "เลขประจำตัวประชาชน",
          "ชื่อ", "นามสกุล", "ชั้น", "ห้อง",
          "student_code", "national_id", "first_name", "last_name",
        ];
        const findHeaderIdx = (matrix: any[][]): number => {
          const max = Math.min(matrix.length, 15);
          for (let i = 0; i < max; i++) {
            const row = (matrix[i] || []).map((c) => String(c ?? "").trim());
            const hits = row.filter((c) => HEADER_HINTS.some((h) => c.includes(h))).length;
            if (hits >= 2) return i;
          }
          return 0;
        };
        const matrixToObjects = (matrix: any[][], headerIdx: number) => {
          const rawHeaders = (matrix[headerIdx] || []).map((c) => String(c ?? "").trim());
          // Deduplicate repeated headers (DMC repeats "เลขประจำตัวนักเรียน")
          const seen: Record<string, number> = {};
          const headers = rawHeaders.map((h) => {
            if (!h) return "";
            if (seen[h] == null) { seen[h] = 0; return h; }
            seen[h] += 1; return `${h}__${seen[h]}`;
          });
          return matrix.slice(headerIdx + 1)
            .filter((r) => r && r.some((c) => c !== null && c !== undefined && String(c).trim() !== ""))
            .map((r) => {
              const obj: any = {};
              headers.forEach((h, i) => { if (h) obj[h] = r[i] ?? ""; });
              return obj;
            });
        };

        if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true, blankrows: false }) as any[][];
          const headerIdx = findHeaderIdx(matrix);
          rows = matrixToObjects(matrix, headerIdx);
        } else {
          // CSV
          const text = data as string;
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          if (lines.length < 2) { swal.error("ไฟล์ว่างเปล่า"); return; }
          const matrix = lines.map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
          const headerIdx = findHeaderIdx(matrix);
          rows = matrixToObjects(matrix, headerIdx);
        }

        if (rows.length === 0) { swal.error("ไม่พบข้อมูลในไฟล์"); return; }

        // Map DMC columns to our fields
        // Helper: normalize any cell value to a YYYY-MM-DD string when it looks like a date.
        // Auto-detects Buddhist Era (year > 2400) and subtracts 543 when autoConvertBE is true.
        // Supports:
        //   - JS Date objects (from Excel date cells)
        //   - Numeric Excel serials (e.g. 45000)
        //   - d/m/yyyy, dd-mm-yyyy, d.m.yyyy (Thai/EU order)
        //   - yyyy-mm-dd, yyyy/mm/dd, yyyy.mm.dd (ISO order)
        //   - Compact 8-digit yyyymmdd / ddmmyyyy
        //   - Thai text dates: "4 มิถุนายน 2562", "4 มิ.ย. 62"
        //   - English text dates: "4 June 2019", "Jun 4, 2019"
        const TH_MONTHS: Record<string, number> = {
          "ม.ค.":1,"มกราคม":1,"ก.พ.":2,"กุมภาพันธ์":2,"มี.ค.":3,"มีนาคม":3,
          "เม.ย.":4,"เมษายน":4,"พ.ค.":5,"พฤษภาคม":5,"มิ.ย.":6,"มิถุนายน":6,
          "ก.ค.":7,"กรกฎาคม":7,"ส.ค.":8,"สิงหาคม":8,"ก.ย.":9,"กันยายน":9,
          "ต.ค.":10,"ตุลาคม":10,"พ.ย.":11,"พฤศจิกายน":11,"ธ.ค.":12,"ธันวาคม":12,
        };
        const EN_MONTHS: Record<string, number> = {
          jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,
          may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,
          oct:10,october:10,nov:11,november:11,dec:12,december:12,
        };
        const fmt = (y: number, m: number, d: number): string | null => {
          if (autoConvertBE && y > 2400) y -= 543;
          if (y < 1900 || y > 2999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
          return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        };
        const fromExcelSerial = (n: number): string | null => {
          if (!isFinite(n) || n < 1 || n > 200000) return null;
          // Excel epoch: 1899-12-30 (accounts for 1900 leap bug)
          const ms = Math.round(n * 86400000) + Date.UTC(1899, 11, 30);
          const d = new Date(ms);
          return fmt(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        };
        const normalizeDateCell = (v: any): any => {
          if (v == null || v === "") return v;
          if (v instanceof Date && !isNaN(v.getTime())) {
            return fmt(v.getFullYear(), v.getMonth() + 1, v.getDate()) ?? v;
          }
          if (typeof v === "number") {
            return fromExcelSerial(v) ?? v;
          }
          if (typeof v !== "string") return v;
          let s = v.trim().replace(/\s+/g, " ");
          if (!s) return v;

          // Strip trailing time portion (e.g. "2019-06-04 00:00:00")
          s = s.replace(/[T\s]\d{1,2}:\d{2}(:\d{2})?.*$/, "");

          // Pure numeric string → try Excel serial
          if (/^\d+(\.\d+)?$/.test(s)) {
            const r = fromExcelSerial(parseFloat(s));
            if (r) return r;
          }

          // Compact 8-digit yyyymmdd
          let m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
          if (m) return fmt(+m[1], +m[2], +m[3]) ?? v;
          // Compact 8-digit ddmmyyyy
          m = s.match(/^(\d{2})(\d{2})(\d{4})$/);
          if (m) return fmt(+m[3], +m[2], +m[1]) ?? v;

          // ISO-ish: yyyy[-/.]mm[-/.]dd
          m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
          if (m) return fmt(+m[1], +m[2], +m[3]) ?? v;

          // EU/Thai: d[-/.]m[-/.]yyyy  (also 2-digit year)
          m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
          if (m) {
            let y = parseInt(m[3], 10);
            if (y < 100) y += y >= 50 ? 1900 : 2000;
            return fmt(y, +m[2], +m[1]) ?? v;
          }

          // Thai text: "4 มิถุนายน 2562" / "4 มิ.ย. 62"
          const tm = s.match(/^(\d{1,2})\s*([ก-๙.]+)\s*(\d{2,4})$/);
          if (tm) {
            const mon = TH_MONTHS[tm[2]];
            if (mon) {
              let y = parseInt(tm[3], 10);
              if (y < 100) y += y >= 50 ? 2400 : 2500; // Thai 2-digit assumed BE
              return fmt(y, mon, +tm[1]) ?? v;
            }
          }

          // English text: "4 June 2019" / "June 4 2019" / "Jun 4, 2019"
          const em1 = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{2,4})$/);
          if (em1) {
            const mon = EN_MONTHS[em1[2].toLowerCase()];
            if (mon) {
              let y = parseInt(em1[3], 10);
              if (y < 100) y += y >= 50 ? 1900 : 2000;
              return fmt(y, mon, +em1[1]) ?? v;
            }
          }
          const em2 = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{2,4})$/);
          if (em2) {
            const mon = EN_MONTHS[em2[1].toLowerCase()];
            if (mon) {
              let y = parseInt(em2[3], 10);
              if (y < 100) y += y >= 50 ? 1900 : 2000;
              return fmt(y, mon, +em2[2]) ?? v;
            }
          }

          return v;
        };


        const parsed = rows.map((row) => {
          const mapped: any = {};
          Object.entries(row).forEach(([key, value]) => {
            const cleanKey = String(key ?? "").replace(/^\uFEFF/, "").trim();
            const normalizedKey = cleanKey.replace(/__\d+$/, "").trim();
            // 1) exact DMC map  2) fuzzy alias matcher (handles หลายสไตล์/ภาษา/ตัวพิมพ์)  3) snake_case fallback
            const fieldName =
              DMC_STUDENT_MAP[normalizedKey] ||
              matchAlias(normalizedKey, STUDENT_ALIASES) ||
              normalizedKey.toLowerCase().replace(/\s+/g, "_");
            const normalizedValue = value instanceof Date ? normalizeDateCell(value) : String(value ?? "").trim();

            // DMC exports can include repeated headers such as
            // "เลขประจำตัวนักเรียน", "รหัสนักเรียน", or "รหัสโรงเรียน".
            // Keep the shorter school/student running number as student_code and avoid
            // overwriting it with the 13-digit national/DMC identifier column.
            if (fieldName === "student_code") {
              const current = String(mapped.student_code || "").trim();
              const incoming = String(normalizedValue || "").trim();
              if (!current) {
                mapped.student_code = incoming;
                return;
              }
              const currentDigits = current.replace(/\D/g, "");
              const incomingDigits = incoming.replace(/\D/g, "");
              const currentLooksLikeShortCode = currentDigits.length > 0 && currentDigits.length <= 6;
              const incomingLooksLikeShortCode = incomingDigits.length > 0 && incomingDigits.length <= 6;

              if (!currentLooksLikeShortCode && incomingLooksLikeShortCode) {
                mapped.student_code = incoming;
              }
              return;
            }

            // Date cells: auto-normalize (handles BE→CE if enabled). Other values → trimmed string.
            mapped[fieldName] = normalizedValue;
          });


          // Normalize prefix from DMC full text to abbreviated form
          const prefixMap: Record<string, string> = {
            "เด็กชาย": "ด.ช.", "เด็กหญิง": "ด.ญ.",
            "นาย": "นาย", "นาง": "นาง", "นางสาว": "นางสาว", "น.ส.": "น.ส.",
          };
          if (mapped.prefix && prefixMap[mapped.prefix]) {
            mapped.prefix = prefixMap[mapped.prefix];
          }

          // Normalize gender from DMC short form
          if (mapped.gender === "ช") mapped.gender = "ช";
          else if (mapped.gender === "ญ") mapped.gender = "ญ";

          // Build father/mother full names from DMC separate prefix+first+last columns
          if (mapped._father_prefix || mapped._father_first) {
            const parts = [mapped._father_prefix, mapped._father_first, mapped._father_last].filter(Boolean);
            if (parts.length > 0 && !mapped.father_name) mapped.father_name = parts.join(" ");
          }
          if (mapped._mother_prefix || mapped._mother_first) {
            const parts = [mapped._mother_prefix, mapped._mother_first, mapped._mother_last].filter(Boolean);
            if (parts.length > 0 && !mapped.mother_name) mapped.mother_name = parts.join(" ");
          }
          if (mapped._guardian_prefix || mapped._guardian_first) {
            const parts = [mapped._guardian_prefix, mapped._guardian_first, mapped._guardian_last].filter(Boolean);
            if (parts.length > 0 && !mapped.guardian_name) mapped.guardian_name = parts.join(" ");
          }

          // Normalize all date-like fields (BE→CE auto when enabled)
          const DATE_FIELDS = [
            "date_of_birth", "hire_date", "start_date", "end_date",
            "enrollment_date", "graduation_date", "issue_date", "expire_date",
          ];
          for (const f of DATE_FIELDS) {
            if (mapped[f]) mapped[f] = normalizeDateCell(mapped[f]);
          }
          if (typeof mapped.date_of_birth !== "string") mapped.date_of_birth = "";




          // Determine role from data.
          // DMC ไฟล์นี้เป็นข้อมูลนักเรียนล้วน — default = student เสมอ
          // ยกเว้นมี position ระบุชัดว่าเป็นผู้บริหาร/บุคลากร
          if (!mapped.role) {
            if (mapped.position === "ผู้อำนวยการ" || mapped.position === "รองผู้อำนวยการ") mapped.role = "director";
            else mapped.role = "student";
          }


          // Email rules:
          // - นักเรียน (student): บังคับใช้ student_code@domain เสมอ (override email จากไฟล์)
          // - อื่นๆ: ใช้ email ในไฟล์ ถ้าไม่มีค่อย auto-generate
          const domain = settingEmailDomain || "@school.com";
          if (mapped.role === "student" && mapped.student_code) {
            mapped.email = `${String(mapped.student_code).toLowerCase().replace(/[^a-z0-9]/g, "")}${domain}`;
          } else if (!mapped.email) {
            if (mapped.student_code) {
              mapped.email = `${String(mapped.student_code).toLowerCase().replace(/[^a-z0-9]/g, "")}${domain}`;
            } else if (mapped.first_name) {
              mapped.email = `${mapped.first_name.replace(/\s/g, "")}${domain}`;
            }
          }

          mapped.password = mapped.password || "School@1234";
          mapped.department = mapped.department || mapped.grade_level || "";

          return mapped;
        }).filter((u) => u.first_name);

        if (parsed.length === 0) { swal.error("ไม่พบข้อมูลที่สามารถนำเข้าได้"); return; }

        // Detect import type
        const hasStudentCodes = parsed.some((u) => u.student_code);
        setBulkImportType(hasStudentCodes ? "student" : "teacher");
        setBulkUsers(parsed);
        setBulkPreview(true);
        setBulkOpen(true);
      } catch {
        swal.error("ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์");
      }
    };

    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseDMCFile(file);
  };

  const handleBulkImport = async () => {
    if (bulkUsers.length === 0) return;
    setSaving(true);
    try {
      const BATCH_SIZE = 8;
      const allResults: any[] = [];
      const totalBatches = Math.ceil(bulkUsers.length / BATCH_SIZE);

      for (let i = 0; i < bulkUsers.length; i += BATCH_SIZE) {
        const batch = bulkUsers.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        swal.toast.info(`กำลังนำเข้า batch ${batchNum}/${totalBatches} (${batch.length} คน)...`);

        const { data, error } = await supabase.functions.invoke("manage-users", {
          body: { action: "bulk_create", users: batch },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        allResults.push(...(data?.results || []));
      }

      const success = allResults.filter((r: any) => r.success).length;
      const failed = allResults.filter((r: any) => !r.success).length;
      swal.toast.success(`นำเข้าสำเร็จ ${success} คน${failed > 0 ? `, ข้าม/ผิดพลาด ${failed} คน` : ""}`);
      setImportResults(allResults);
      setImportSummaryOpen(true);
      setBulkOpen(false); setBulkUsers([]); setBulkPreview(false); fetchUsers();
    } catch (e: any) {
      swal.error(e.message || "Bulk import failed");
    }
    setSaving(false);
  };

  const downloadTemplate = (type: "student" | "teacher") => {
    if (type === "student") {
      const csv = `รหัสนักเรียน,เลขประจำตัวประชาชน,คำนำหน้าชื่อ,ชื่อ,นามสกุล,เพศ,วันเกิด,ชั้น,สัญชาติ,เชื้อชาติ,ศาสนา,หมู่โลหิต,น้ำหนัก,ส่วนสูง,จังหวัดที่เกิด,คำนำหน้าชื่อบิดา,ชื่อบิดา,นามสกุลบิดา,หมายเลขโทรศัพท์ของบิดา,อาชีพบิดา,คำนำหน้าชื่อมารดา,ชื่อมารดา,นามสกุลมารดา,หมายเลขโทรศัพท์ของมารดา,อาชีพมารดา,ความเกี่ยวข้องของผู้ปกครองกับนักเรียน,คำนำหน้าชื่อผู้ปกครอง,ชื่อผู้ปกครอง,นามสกุลผู้ปกครอง,หมายเลขโทรศัพท์ของผู้ปกครอง
2831,1100000000001,เด็กชาย,สมชาย,ใจดี,ช,03/09/2558,ป.1,ไทย,ไทย,พุทธ,O,25.0,120.0,กรุงเทพมหานคร,นาย,สมศักดิ์,ใจดี,0800000002,รับจ้าง,นาง,สมหญิง,ใจดี,0800000003,ค้าขาย,มารดา,นาง,สมหญิง,ใจดี,0800000003`;
      downloadCSV(csv, "dmc_student_template.csv");
    } else {
      const csv = `คำนำหน้า,ชื่อ,นามสกุล,อีเมล,ตำแหน่ง,วิทยฐานะ,ฝ่ายงาน,บทบาท,โทรศัพท์,เลขประจำตัวประชาชน
นาย,สมชาย,รักสอน,teacher1@school.com,ครู,ครูชำนาญการ (คศ.2),วิชาการ,teacher,0800000001,1100000000001
นาง,สมหญิง,รักเรียน,director@school.com,ผู้อำนวยการ,ผอ.ชำนาญการพิเศษ,บริหารทั่วไป,director,0800000002,1100000000002`;
      downloadCSV(csv, "dmc_teacher_template.csv");
    }
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const userStats = {
    total: users.length,
    admin: users.filter(u => u.role === "admin").length,
    director: users.filter(u => u.role === "director").length,
    teacher: users.filter(u => u.role === "teacher").length,
    student: users.filter(u => u.role === "student").length,
    alumni: users.filter(u => u.role === "alumni").length,
    
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
            ผู้ใช้งาน
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">มาตรฐาน DMC · สพฐ.</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Primary actions */}
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <FileSpreadsheet className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">นำเข้า DMC</span>
          </Button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none px-2 py-1 rounded border bg-background hover:bg-muted/50" title="ตรวจจับเซลล์วันที่ที่เป็นปีพุทธศักราช (เช่น 2562) แล้วลบ 543 เพื่อแปลงเป็นปี ค.ศ. อัตโนมัติ">
            <input
              type="checkbox"
              checked={autoConvertBE}
              onChange={(e) => setAutoConvertBE(e.target.checked)}
              className="w-3.5 h-3.5 accent-primary"
            />
            แปลง พ.ศ.→ค.ศ. อัตโนมัติ
          </label>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={handleFileUpload} />


          {/* Tools menu — รวมเครื่องมือดูแลระบบ */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" title="เครื่องมือ">
                <Wrench className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">เครื่องมือ</span>
                <MoreHorizontal className="w-3.5 h-3.5 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>ตั้งค่า</DropdownMenuLabel>
              <DropdownMenuItem asChild className="gap-2">
                <RouterLink to="/dashboard/admin/school-settings">
                  <Settings className="w-4 h-4" /> ตั้งค่าโรงเรียน
                </RouterLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>ดูแลข้อมูล</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleSyncPersonnel} disabled={syncing} className="gap-2">
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> ซิงค์บุคลากร
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCleanupOrphaned} disabled={syncing} className="gap-2 text-destructive focus:text-destructive">
                <Eraser className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> ล้างข้อมูลค้าง
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGraduateOpen(true)} disabled={graduating} className="gap-2 text-amber-600 focus:text-amber-700">
                <GraduationCap className={`w-4 h-4 ${graduating ? "animate-bounce" : ""}`} /> จบการศึกษาอัตโนมัติ
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>บัญชี & รหัสผ่าน</DropdownMenuLabel>
              <DropdownMenuItem asChild className="gap-2">
                <RouterLink to="/dashboard/admin/teacher-credentials">
                  <KeyRound className="w-4 h-4" /> รหัสผ่าน/Username ครู (CSV + Bulk Reset)
                </RouterLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-destructive">โซนอันตราย</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setDeleteStudentsOpen(true)} disabled={!!deletingByRole} className="gap-2 text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4" /> ลบนักเรียนทั้งหมด
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteTeachersOpen(true)} disabled={!!deletingByRole} className="gap-2 text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4" /> ลบครู/ผอ. ทั้งหมด
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Controlled AlertDialogs */}
          <AlertDialog open={graduateOpen} onOpenChange={setGraduateOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>จบการศึกษาอัตโนมัติ</AlertDialogTitle>
                <AlertDialogDescription>
                  ระบบจะย้ายนักเรียนในระดับชั้น {settingTerminalGrades.join(", ")} ไปเป็นศิษย์เก่า พร้อมบันทึก GPA สะสมอัตโนมัติ ดำเนินการต่อหรือไม่?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction onClick={handleGraduateTerminal}>
                  {graduating ? "กำลังดำเนินการ..." : "ยืนยันจบการศึกษา"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={deleteStudentsOpen} onOpenChange={setDeleteStudentsOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>⚠️ ลบข้อมูลนักเรียนทั้งหมด</AlertDialogTitle>
                <AlertDialogDescription>
                  คุณต้องการลบข้อมูลนักเรียนทั้งหมด ({userStats.student} คน) รวมถึงข้อมูลที่เกี่ยวข้อง (เช่น เช็คชื่อ, คะแนน, พฤติกรรม) ใช่หรือไม่?
                  <br /><strong className="text-destructive">การดำเนินการนี้ไม่สามารถย้อนกลับได้!</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDeleteByRole("student")} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deletingByRole === "student" ? "กำลังลบ..." : `ยืนยันลบนักเรียน ${userStats.student} คน`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={deleteTeachersOpen} onOpenChange={setDeleteTeachersOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>⚠️ ลบข้อมูลครูและผู้อำนวยการทั้งหมด</AlertDialogTitle>
                <AlertDialogDescription>
                  คุณต้องการลบข้อมูลครู ({userStats.teacher} คน) และผู้อำนวยการ ({userStats.director} คน) รวมถึงข้อมูลบุคลากรที่เกี่ยวข้อง ใช่หรือไม่?
                  <br /><strong className="text-destructive">การดำเนินการนี้ไม่สามารถย้อนกลับได้!</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDeleteByRole("teacher")} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deletingByRole === "teacher" ? "กำลังลบ..." : `ยืนยันลบครู/ผอ. ${userStats.teacher + userStats.director} คน`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="shadow-sm">
                <UserPlus className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">เพิ่มผู้ใช้</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg sm:max-h-[90vh] sm:overflow-y-auto">
              <DialogHeader><DialogTitle>เพิ่มผู้ใช้งานใหม่</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {/* Role Selection */}
                <div><Label>บทบาท *</Label>
                  <Select value={formRole} onValueChange={(v) => {
                    setFormRole(v as AppRole);
                    if (v === "student") setFormPrefix("ด.ช.");
                    else setFormPrefix("นาย");
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">{t("role.admin")}</SelectItem>
                      <SelectItem value="director">{t("role.director")}</SelectItem>
                      <SelectItem value="teacher">{t("role.teacher")}</SelectItem>
                      <SelectItem value="student">{t("role.student")}</SelectItem>
                      <SelectItem value="alumni">{t("role.alumni")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Common fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><Label>คำนำหน้า</Label>
                    <Select value={formPrefix} onValueChange={setFormPrefix}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(formRole === "student" ? PREFIXES_STUDENT : PREFIXES_STAFF).map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>ชื่อ *</Label><Input value={formFirstName} onChange={(e) => setFormFirstName(e.target.value)} /></div>
                  <div><Label>นามสกุล *</Label><Input value={formLastName} onChange={(e) => setFormLastName(e.target.value)} /></div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div><Label>เลขบัตรประชาชน</Label><Input placeholder="13 หลัก" maxLength={13} value={formNationalId} onChange={(e) => setFormNationalId(e.target.value)} /></div>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-2">เพศจะถูกกำหนดอัตโนมัติจากคำนำหน้าชื่อ</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>วันเกิด</Label><BEDatePicker value={formDateOfBirth} onChange={(v) => setFormDateOfBirth(v)} /></div>
                  <div><Label>โทรศัพท์</Label><Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} /></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>อีเมล *</Label>
                    <div className="flex min-w-0">
                      <Input
                        placeholder="username"
                        value={formEmail.replace(settingEmailDomain, "")}
                        onChange={(e) => setFormEmail(e.target.value.replace(/@.*$/, "") + settingEmailDomain)}
                        className="rounded-r-none min-w-0 flex-1"
                      />
                      <span className="inline-flex items-center px-2 sm:px-3 rounded-r-md border border-l-0 border-input bg-muted text-xs sm:text-sm text-muted-foreground whitespace-nowrap max-w-[45%] truncate">
                        {settingEmailDomain}
                      </span>
                    </div>
                  </div>
                  <div><Label>รหัสผ่าน *</Label><Input value={formPassword} onChange={(e) => setFormPassword(e.target.value)} /><p className="text-xs text-muted-foreground mt-1">ค่าเริ่มต้น: School@1234</p></div>
                </div>

                {/* Student-specific */}
                {formRole === "student" && (
                  <div className="border-t pt-4 space-y-3">
                    <h3 className="font-medium text-sm text-primary">ข้อมูลนักเรียน (DMC)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>รหัสนักเรียน *</Label><Input placeholder="STU-0001" value={formStudentCode} onChange={(e) => setFormStudentCode(e.target.value)} /></div>
                      <div><Label>ระดับชั้น</Label>
                        <Select value={formGradeLevel} onValueChange={setFormGradeLevel}>
                          <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                          <SelectContent>{GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Teacher/Director-specific */}
                {formRole !== "student" && (
                  <div className="border-t pt-4 space-y-3">
                    <h3 className="font-medium text-sm text-primary">ข้อมูลบุคลากร</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>ตำแหน่ง</Label>
                        <Select value={formPosition} onValueChange={setFormPosition}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>วิทยฐานะ</Label>
                        <Select value={formAcademicStanding} onValueChange={setFormAcademicStanding}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{ACADEMIC_STANDINGS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>ฝ่ายงาน</Label>
                        <Select value={formDept} onValueChange={setFormDept}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>กลุ่มสาระการเรียนรู้</Label>
                        <Select value={formSubjectGroup} onValueChange={setFormSubjectGroup}>
                          <SelectTrigger><SelectValue placeholder="เลือกหมวดวิชา" /></SelectTrigger>
                          <SelectContent>{SUBJECT_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setAddOpen(false)} className="w-full sm:w-auto">ยกเลิก</Button>
                <Button onClick={handleAddUser} disabled={saving} className="w-full sm:w-auto">{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "ทั้งหมด", count: userStats.total, color: "text-foreground" },
          { label: "ผู้ดูแลระบบ", count: userStats.admin, color: "text-destructive" },
          { label: "ผู้อำนวยการ", count: userStats.director, color: "text-orange-600" },
          { label: "ครู/บุคลากร", count: userStats.teacher, color: "text-primary" },
          { label: "นักเรียน", count: userStats.student, color: "text-sky-600" },
          { label: "ศิษย์เก่า", count: userStats.alumni, color: "text-emerald-600" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="py-3 px-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk Import Preview Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-4xl sm:max-h-[85vh] sm:overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              นำเข้าจากไฟล์ DMC — {bulkUsers.length} รายการ ({bulkImportType === "student" ? "นักเรียน" : "บุคลากร"})
            </DialogTitle>
          </DialogHeader>
          {bulkPreview && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">ตรวจสอบข้อมูลก่อนนำเข้า (แสดง {Math.min(bulkUsers.length, 20)} รายการแรก):</div>
              <div className="rounded-md border overflow-auto max-h-72 -mx-2 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>คำนำหน้า</TableHead>
                      <TableHead>ชื่อ-นามสกุล</TableHead>
                      <TableHead>เลขประชาชน</TableHead>
                      {bulkImportType === "student" ? (
                        <>
                          <TableHead>รหัส นร.</TableHead>
                          <TableHead>ระดับชั้น</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>ตำแหน่ง</TableHead>
                          <TableHead>วิทยฐานะ</TableHead>
                          <TableHead>ฝ่ายงาน</TableHead>
                        </>
                      )}
                      <TableHead>อีเมล</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkUsers.slice(0, 20).map((u, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-xs">{u.prefix || "—"}</TableCell>
                        <TableCell>{u.first_name} {u.last_name}</TableCell>
                        <TableCell className="text-xs font-mono">{u.national_id || "—"}</TableCell>
                        {bulkImportType === "student" ? (
                          <>
                            <TableCell className="text-xs font-mono">{u.student_code || "—"}</TableCell>
                            <TableCell className="text-xs">{u.grade_level || "—"}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-xs">{u.position || "—"}</TableCell>
                            <TableCell className="text-xs">{u.academic_standing || "—"}</TableCell>
                            <TableCell className="text-xs">{u.department || "—"}</TableCell>
                          </>
                        )}
                        <TableCell className="text-xs">{u.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {bulkUsers.length > 20 && (
                <p className="text-xs text-muted-foreground text-center">... และอีก {bulkUsers.length - 20} รายการ</p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setBulkOpen(false); setBulkUsers([]); }} className="w-full sm:w-auto">ยกเลิก</Button>
            <Button onClick={handleBulkImport} disabled={saving} className="w-full sm:w-auto">
              <Upload className="w-4 h-4 mr-1" />
              {saving ? "กำลังนำเข้า..." : `นำเข้า ${bulkUsers.length} รายการ`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Summary Dialog */}
      <Dialog open={importSummaryOpen} onOpenChange={setImportSummaryOpen}>
        <DialogContent className="sm:max-w-5xl sm:max-h-[88vh] sm:overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              สรุปผลการนำเข้า DMC
            </DialogTitle>
          </DialogHeader>
          {importResults && (() => {
            const created = importResults.filter((r) => r.action === "created" && r.success);
            const updated = importResults.filter((r) => r.action === "updated" && r.success);
            const skipped = importResults.filter((r) => r.action === "skipped");
            const failed = importResults.filter((r) => r.action === "failed" || (!r.success && r.action !== "skipped"));
            const FIELD_LABELS_LOCAL: Record<string, string> = {
              prefix: "คำนำหน้า", first_name: "ชื่อ", last_name: "นามสกุล",
              national_id: "เลขประชาชน", student_code: "รหัสนักเรียน",
              gender: "เพศ", date_of_birth: "วันเกิด", phone: "โทร", address: "ที่อยู่",
              nationality: "สัญชาติ", ethnicity: "เชื้อชาติ", religion: "ศาสนา",
              blood_type: "หมู่เลือด", weight: "น้ำหนัก", height: "ส่วนสูง",
              birth_province: "จังหวัดเกิด", classroom_id: "ห้องเรียน", auth_user_id: "บัญชีผู้ใช้",
              father_name: "ชื่อบิดา", father_phone: "โทรบิดา", father_id: "บัตรบิดา", father_occupation: "อาชีพบิดา",
              mother_name: "ชื่อมารดา", mother_phone: "โทรมารดา", mother_id: "บัตรมารดา", mother_occupation: "อาชีพมารดา",
              guardian_name: "ชื่อผู้ปกครอง", guardian_phone: "โทรผู้ปกครอง", guardian_relation: "ความสัมพันธ์",
              previous_school: "โรงเรียนเดิม",
              position: "ตำแหน่ง", academic_standing: "วิทยฐานะ", department: "ฝ่ายงาน",
              subject_group: "กลุ่มสาระ",
            };
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border bg-emerald-500/10 p-3">
                    <div className="text-xs text-muted-foreground">สร้างใหม่</div>
                    <div className="text-2xl font-bold text-emerald-500">{created.length}</div>
                  </div>
                  <div className="rounded-lg border bg-sky-500/10 p-3">
                    <div className="text-xs text-muted-foreground">อัปเดตข้อมูลเดิม</div>
                    <div className="text-2xl font-bold text-sky-500">{updated.length}</div>
                  </div>
                  <div className="rounded-lg border bg-amber-500/10 p-3">
                    <div className="text-xs text-muted-foreground">ข้าม (ข้อมูลไม่พอ)</div>
                    <div className="text-2xl font-bold text-amber-500">{skipped.length}</div>
                  </div>
                  <div className="rounded-lg border bg-rose-500/10 p-3">
                    <div className="text-xs text-muted-foreground">ผิดพลาด</div>
                    <div className="text-2xl font-bold text-rose-500">{failed.length}</div>
                  </div>
                </div>

                {skipped.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="text-sm font-semibold text-amber-600 mb-2">รายการที่ข้าม</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {skipped.map((r, i) => (
                        <div key={i} className="text-xs flex gap-2">
                          <span className="font-medium">{r.name || r.email || "(ไม่ระบุชื่อ)"}</span>
                          <span className="text-muted-foreground">— {r.skip_reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {failed.length > 0 && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
                    <p className="text-sm font-semibold text-rose-600 mb-2">รายการผิดพลาด</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {failed.map((r, i) => (
                        <div key={i} className="text-xs flex gap-2">
                          <span className="font-medium">{r.name || r.email || "(ไม่ระบุชื่อ)"}</span>
                          <span className="text-muted-foreground">— {r.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-md border overflow-auto max-h-96 -mx-2 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ชื่อ</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>จับคู่ด้วย</TableHead>
                        <TableHead>ฟิลด์ที่เติม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResults.filter((r) => r.success).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">
                            {r.name || "—"}
                            {r.student_code && <span className="text-xs text-muted-foreground ml-1">({r.student_code})</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              r.action === "created" ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                                : r.action === "updated" ? "border-sky-500/40 text-sky-500 bg-sky-500/10"
                                : ""
                            }>
                              {r.action === "created" ? "สร้างใหม่" : r.action === "updated" ? "อัปเดต" : r.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.matched_by === "student_code" ? "รหัสนักเรียน"
                              : r.matched_by === "name" ? "ชื่อ-นามสกุล"
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 sm:max-w-md">
                              {(r.filled_fields || []).length === 0 ? (
                                <span className="text-xs text-muted-foreground italic">ไม่มี</span>
                              ) : (
                                (r.filled_fields || []).map((f: string) => (
                                  <Badge key={f} variant="secondary" className="text-[10px] font-normal">
                                    {FIELD_LABELS_LOCAL[f] || f}
                                  </Badge>
                                ))
                              )}
                              {(r.filled_fields || []).length > 0 && (
                                <span className="text-[10px] text-muted-foreground self-center ml-1">
                                  ({r.filled_count} ฟิลด์)
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button onClick={() => setImportSummaryOpen(false)} className="w-full sm:w-auto">ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditUser(null); }}>
        <DialogContent className="sm:max-w-4xl sm:max-h-[92vh] sm:overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              แก้ไขผู้ใช้ — admin จุดศูนย์กลาง
            </DialogTitle>
          </DialogHeader>
          {editUser && (
            <Tabs defaultValue="account" className="w-full">
              <TabsList className="w-full justify-start flex-wrap h-auto">
                <TabsTrigger value="account">บัญชี & สิทธิ์</TabsTrigger>
                <TabsTrigger value="personal">ข้อมูลส่วนตัว</TabsTrigger>
                {editForm.role === "student" && <TabsTrigger value="dmc">DMC / ผู้ปกครอง</TabsTrigger>}
                {editForm.role !== "student" && <TabsTrigger value="staff">ข้อมูลบุคลากร</TabsTrigger>}
                <TabsTrigger value="password">รหัสผ่าน</TabsTrigger>
              </TabsList>

              {editLoading && (
                <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin" /> กำลังโหลดข้อมูลทั้งหมด...
                </div>
              )}

              {/* TAB 1: บัญชี & สิทธิ์ */}
              <TabsContent value="account" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>อีเมล</Label><Input value={editForm.email || ""} onChange={(e) => setF("email", e.target.value)} /></div>
                  <div>
                    <Label>บทบาท</Label>
                    <Select value={editForm.role} onValueChange={(v) => setF("role", v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{t("role.admin")}</SelectItem>
                        <SelectItem value="director">{t("role.director")}</SelectItem>
                        <SelectItem value="teacher">{t("role.teacher")}</SelectItem>
                        <SelectItem value="student">{t("role.student")}</SelectItem>
                        <SelectItem value="alumni">{t("role.alumni")}</SelectItem>
                        
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><Label>คำนำหน้า</Label>
                    <Select value={editForm.prefix || ""} onValueChange={(v) => setF("prefix", v)}>
                      <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                      <SelectContent>
                        {[...PREFIXES_STAFF, ...PREFIXES_STUDENT].filter((v, i, a) => a.indexOf(v) === i).map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>ชื่อ</Label><Input value={editForm.first_name || ""} onChange={(e) => setF("first_name", e.target.value)} /></div>
                  <div><Label>นามสกุล</Label><Input value={editForm.last_name || ""} onChange={(e) => setF("last_name", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editForm.role === "student" ? (
                    <div><Label>รหัสนักเรียน</Label><Input value={editForm.student_code || ""} onChange={(e) => setF("student_code", e.target.value)} /></div>
                  ) : (
                    <div><Label>รหัสบุคลากร</Label><Input value={editForm.employee_code || ""} onChange={(e) => setF("employee_code", e.target.value)} /></div>
                  )}
                  <div className="flex items-end gap-3 pb-1">
                    <Switch checked={!!editForm.is_approved} onCheckedChange={(v) => setF("is_approved", v)} />
                    <Label>อนุมัติบัญชีแล้ว</Label>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: ข้อมูลส่วนตัว */}
              <TabsContent value="personal" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><Label>ชื่อเล่น</Label><Input value={editForm.nickname || ""} onChange={(e) => setF("nickname", e.target.value)} /></div>
                  <div><Label>เพศ (จากคำนำหน้า)</Label>
                    <Input value={editForm.gender || "—"} disabled className="bg-muted" />
                  </div>
                  <div><Label>วันเกิด</Label><BEDatePicker value={editForm.date_of_birth || ""} onChange={(v) => setF("date_of_birth", v)} /></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><Label>โทรศัพท์</Label><Input value={editForm.phone || ""} onChange={(e) => setF("phone", e.target.value)} /></div>
                  <div><Label>หมู่เลือด</Label>
                    <Select value={editForm.blood_type || ""} onValueChange={(v) => setF("blood_type", v)}>
                      <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                      <SelectContent>
                        {["A", "B", "AB", "O"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>LINE ID</Label><Input value={editForm.line_id || ""} onChange={(e) => setF("line_id", e.target.value)} /></div>
                </div>
                <div><Label>Facebook URL</Label><Input value={editForm.facebook_url || ""} onChange={(e) => setF("facebook_url", e.target.value)} placeholder="https://facebook.com/..." /></div>
                <div><Label>ที่อยู่</Label><Textarea rows={2} value={editForm.address || ""} onChange={(e) => setF("address", e.target.value)} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>ผู้ติดต่อฉุกเฉิน</Label><Input value={editForm.emergency_contact || ""} onChange={(e) => setF("emergency_contact", e.target.value)} /></div>
                  <div><Label>เบอร์ฉุกเฉิน</Label><Input value={editForm.emergency_phone || ""} onChange={(e) => setF("emergency_phone", e.target.value)} /></div>
                </div>
                {editForm.role !== "student" && (
                  <div><Label>ประวัติย่อ / Bio</Label><Textarea rows={2} value={editForm.bio || ""} onChange={(e) => setF("bio", e.target.value)} /></div>
                )}
              </TabsContent>

              {/* TAB 3a: บุคลากร */}
              {editForm.role !== "student" && (
                <TabsContent value="staff" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>ตำแหน่ง</Label>
                      <Select value={editForm.position || ""} onValueChange={(v) => setF("position", v)}>
                        <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                        <SelectContent>{POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>วิทยฐานะ</Label>
                      <Select value={editForm.academic_standing || ""} onValueChange={(v) => setF("academic_standing", v)}>
                        <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                        <SelectContent>{ACADEMIC_STANDINGS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>ฝ่ายงาน</Label>
                      <Select value={editForm.department || ""} onValueChange={(v) => setF("department", v)}>
                        <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                        <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>กลุ่มสาระการเรียนรู้</Label>
                      <Select value={editForm.subject_group || ""} onValueChange={(v) => setF("subject_group", v)}>
                        <SelectTrigger><SelectValue placeholder="เลือกหมวดวิชา" /></SelectTrigger>
                        <SelectContent>{SUBJECT_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>วันที่เริ่มงาน</Label><BEDatePicker value={editForm.hire_date || ""} onChange={(v) => setF("hire_date", v)} /></div>
                    <div><Label>รหัสบุคลากร</Label><Input value={editForm.employee_code || ""} onChange={(e) => setF("employee_code", e.target.value)} /></div>
                  </div>
                </TabsContent>
              )}

              {/* TAB 3b: DMC สำหรับนักเรียน */}
              {editForm.role === "student" && (
                <TabsContent value="dmc" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div><Label>เลขประจำตัวประชาชน</Label><Input value={editForm.national_id || ""} onChange={(e) => setF("national_id", e.target.value)} /></div>
                    <div><Label>ระดับชั้น</Label>
                      <Select value={editForm.grade_level || ""} onValueChange={(v) => { setF("grade_level", v); setF("classroom_id", null); }}>
                        <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                        <SelectContent>{GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>ห้องเรียน</Label>
                      <Select value={editForm.classroom_id || ""} onValueChange={(v) => setF("classroom_id", v)}>
                        <SelectTrigger><SelectValue placeholder="เลือกห้อง" /></SelectTrigger>
                        <SelectContent>
                          {editClassrooms.filter((c: any) => !editForm.grade_level || c.grade_level === editForm.grade_level).map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div><Label>สัญชาติ</Label><Input value={editForm.nationality || ""} onChange={(e) => setF("nationality", e.target.value)} /></div>
                    <div><Label>เชื้อชาติ</Label><Input value={editForm.ethnicity || ""} onChange={(e) => setF("ethnicity", e.target.value)} /></div>
                    <div><Label>ศาสนา</Label><Input value={editForm.religion || ""} onChange={(e) => setF("religion", e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div><Label>น้ำหนัก (kg)</Label><Input type="number" value={editForm.weight ?? ""} onChange={(e) => setF("weight", e.target.value)} /></div>
                    <div><Label>ส่วนสูง (cm)</Label><Input type="number" value={editForm.height ?? ""} onChange={(e) => setF("height", e.target.value)} /></div>
                    <div><Label>จังหวัดที่เกิด</Label><Input value={editForm.birth_province || ""} onChange={(e) => setF("birth_province", e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>โรงเรียนเดิม</Label><Input value={editForm.previous_school || ""} onChange={(e) => setF("previous_school", e.target.value)} /></div>
                    <div><Label>วันที่เข้าเรียน</Label><BEDatePicker value={editForm.admission_date || ""} onChange={(v) => setF("admission_date", v)} /></div>
                  </div>
                  <div className="border rounded-md p-3 bg-amber-50/40 dark:bg-amber-900/10 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-input"
                        checked={!!editForm.is_special_needs}
                        onChange={(e) => {
                          const on = e.target.checked;
                          if (on) {
                            setEditForm((prev: any) => ({
                              ...prev,
                              is_special_needs: true,
                              inclusion_classroom_id: prev?.inclusion_classroom_id || prev?.classroom_id || null,
                              classroom_id: null,
                              grade_level: "การศึกษาพิเศษ",
                            }));
                          } else {
                            setEditForm((prev: any) => {
                              const fallback = prev?.inclusion_classroom_id || null;
                              const cls = fallback ? editClassrooms.find((c: any) => c.id === fallback) : null;
                              return {
                                ...prev,
                                is_special_needs: false,
                                classroom_id: fallback,
                                inclusion_classroom_id: null,
                                special_needs_type: null,
                                grade_level: cls?.grade_level ?? prev?.grade_level ?? "",
                              };
                            });
                          }
                        }}
                      />
                      <span className="font-medium text-sm">เป็นนักเรียนการศึกษาพิเศษ (เรียนรวม)</span>
                    </label>
                    {editForm.is_special_needs && (
                      <div className="space-y-2">
                        <div>
                          <Label>ห้องประจำ (การศึกษาพิเศษ)</Label>
                          <Select
                            value={editForm.classroom_id || ""}
                            onValueChange={(v) => setF("classroom_id", v)}
                          >
                            <SelectTrigger><SelectValue placeholder="เลือกห้องการศึกษาพิเศษ" /></SelectTrigger>
                            <SelectContent>
                              {editClassrooms.filter((c: any) => c.grade_level === "การศึกษาพิเศษ").map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                              {editClassrooms.filter((c: any) => c.grade_level === "การศึกษาพิเศษ").length === 0 && (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                  ยังไม่มีห้องการศึกษาพิเศษ — สร้างก่อนที่หน้าจัดการห้องเรียน
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>ห้องเรียนรวม (ห้องปกติ)</Label>
                          <Select
                            value={editForm.inclusion_classroom_id || ""}
                            onValueChange={(v) => setF("inclusion_classroom_id", v)}
                          >
                            <SelectTrigger><SelectValue placeholder="เลือกห้องเรียนรวม" /></SelectTrigger>
                            <SelectContent>
                              {editClassrooms.filter((c: any) => c.grade_level !== "การศึกษาพิเศษ").map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.grade_level} {c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>ประเภทความต้องการพิเศษ</Label>
                          <Select
                            value={editForm.special_needs_type || ""}
                            onValueChange={(v) => setF("special_needs_type", v)}
                          >
                            <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                            <SelectContent>
                              {SPECIAL_NEEDS_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>หมายเหตุ / รายละเอียดเพิ่มเติม</Label>
                          <Textarea
                            rows={2}
                            value={editForm.special_needs || ""}
                            onChange={(e) => setF("special_needs", e.target.value)}
                            placeholder="เช่น แผน IEP, ครูพี่เลี้ยง, การช่วยเหลือพิเศษ"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div><Label>สถานะนักเรียน</Label>
                    <Select value={editForm.student_status || "active"} onValueChange={(v) => setF("student_status", v)}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">กำลังศึกษา</SelectItem>
                        <SelectItem value="graduated">จบการศึกษา</SelectItem>
                        <SelectItem value="transferred">ย้ายโรงเรียน</SelectItem>
                        <SelectItem value="dropped">ออกกลางคัน</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border-t pt-3 mt-3">
                    <h4 className="font-semibold text-sm mb-2 text-muted-foreground">ข้อมูลบิดา</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>ชื่อ-สกุลบิดา</Label><Input value={editForm.father_name || ""} onChange={(e) => setF("father_name", e.target.value)} /></div>
                      <div><Label>โทรศัพท์บิดา</Label><Input value={editForm.father_phone || ""} onChange={(e) => setF("father_phone", e.target.value)} /></div>
                      <div><Label>เลขบัตรบิดา</Label><Input value={editForm.father_id || ""} onChange={(e) => setF("father_id", e.target.value)} /></div>
                      <div><Label>อาชีพบิดา</Label><Input value={editForm.father_occupation || ""} onChange={(e) => setF("father_occupation", e.target.value)} /></div>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <h4 className="font-semibold text-sm mb-2 text-muted-foreground">ข้อมูลมารดา</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>ชื่อ-สกุลมารดา</Label><Input value={editForm.mother_name || ""} onChange={(e) => setF("mother_name", e.target.value)} /></div>
                      <div><Label>โทรศัพท์มารดา</Label><Input value={editForm.mother_phone || ""} onChange={(e) => setF("mother_phone", e.target.value)} /></div>
                      <div><Label>เลขบัตรมารดา</Label><Input value={editForm.mother_id || ""} onChange={(e) => setF("mother_id", e.target.value)} /></div>
                      <div><Label>อาชีพมารดา</Label><Input value={editForm.mother_occupation || ""} onChange={(e) => setF("mother_occupation", e.target.value)} /></div>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <h4 className="font-semibold text-sm mb-2 text-muted-foreground">ข้อมูลผู้ปกครอง</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div><Label>ชื่อ-สกุลผู้ปกครอง</Label><Input value={editForm.guardian_name || ""} onChange={(e) => setF("guardian_name", e.target.value)} /></div>
                      <div><Label>โทรศัพท์ผู้ปกครอง</Label><Input value={editForm.guardian_phone || ""} onChange={(e) => setF("guardian_phone", e.target.value)} /></div>
                      <div><Label>ความสัมพันธ์</Label><Input value={editForm.guardian_relation || ""} onChange={(e) => setF("guardian_relation", e.target.value)} /></div>
                    </div>
                  </div>
                </TabsContent>
              )}

              {/* TAB 4: รหัสผ่าน */}
              <TabsContent value="password" className="space-y-3 mt-4">
                <Label className="text-sm font-semibold">รีเซ็ตรหัสผ่าน</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="text"
                    placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
                    value={editNewPassword}
                    onChange={(e) => setEditNewPassword(e.target.value)}
                  />
                  <Button
                    variant="destructive"
                    onClick={handleResetPassword}
                    disabled={resettingPassword || !editNewPassword}
                    className="whitespace-nowrap"
                  >
                    {resettingPassword ? "กำลังรีเซ็ต..." : "รีเซ็ตรหัสผ่าน"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">ตั้งรหัสผ่านใหม่ให้ผู้ใช้ที่ลืมรหัสผ่าน</p>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter className="border-t pt-3 mt-2 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="w-full sm:w-auto">ยกเลิก</Button>
            <Button onClick={handleEditUser} disabled={saving || editLoading} className="w-full sm:w-auto">
              {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filter + Search */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" />ผู้ใช้ทั้งหมด</TabsTrigger>
          <TabsTrigger value="departments" className="gap-2"><Shield className="w-4 h-4" />ฝ่ายงาน</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="space-y-6 mt-4">
      <Card className="shadow-card border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="relative max-w-sm flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="ค้นหาชื่อ, อีเมล, รหัส..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <Select value={filterRole} onValueChange={(v) => { setFilterRole(v); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                  <SelectItem value="director">ผู้อำนวยการ</SelectItem>
                  <SelectItem value="teacher">ครู/บุคลากร</SelectItem>
                  <SelectItem value="student">นักเรียน</SelectItem>
                  <SelectItem value="alumni">ศิษย์เก่า</SelectItem>
                  
                </SelectContent>
              </Select>
              <Select value={filterGrade} onValueChange={(v) => { setFilterGrade(v); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="ระดับชั้น" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                  {GRADE_LEVELS.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={bulkDeleting}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      ลบที่เลือก ({selectedIds.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ยืนยันการลบผู้ใช้ {selectedIds.size} คน</AlertDialogTitle>
                      <AlertDialogDescription>
                        คุณต้องการลบผู้ใช้ที่เลือกทั้ง {selectedIds.size} คน ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {bulkDeleting ? "กำลังลบ..." : `ลบ ${selectedIds.size} คน`}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" /> {filteredUsers.length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filteredUsers.length > 0 && selectedIds.size === filteredUsers.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>คำนำหน้า-ชื่อ-นามสกุล</TableHead>
                <TableHead className="hidden md:table-cell">อีเมล</TableHead>
                <TableHead className="hidden sm:table-cell">รหัส</TableHead>
                <TableHead className="hidden lg:table-cell">ฝ่าย/ชั้น</TableHead>
                <TableHead className="hidden xl:table-cell">หมวดวิชา</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead className="hidden md:table-cell">สถานะ</TableHead>
                <TableHead>จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่พบผู้ใช้</TableCell></TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className={selectedIds.has(user.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(user.id)}
                        onCheckedChange={() => toggleSelect(user.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{user.prefix ? `${user.prefix}` : ""}{user.first_name || "-"} {user.last_name || ""}</div>
                      <div className="md:hidden text-xs text-muted-foreground truncate max-w-[180px]">{user.email}</div>
                      <div className="sm:hidden text-xs font-mono text-muted-foreground">{user.student_code || user.employee_code || ""}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{user.email}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs font-mono">{user.student_code || user.employee_code || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{user.department || "—"}</TableCell>
                    <TableCell className="hidden xl:table-cell text-xs">
                      {user.subject_group ? (
                        <Badge variant="outline" className="text-xs">{user.subject_group}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v as AppRole)}>
                        <SelectTrigger className="w-28 md:w-36 h-8 text-xs">
                          <SelectValue>
                            <Badge variant="secondary" className={roleColors[user.role]}>{t(`role.${user.role}`)}</Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{t("role.admin")}</SelectItem>
                          <SelectItem value="director">{t("role.director")}</SelectItem>
                          <SelectItem value="teacher">{t("role.teacher")}</SelectItem>
                          <SelectItem value="student">{t("role.student")}</SelectItem>
                          <SelectItem value="alumni">{t("role.alumni")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.is_approved ? (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">อนุมัติแล้ว</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                          onClick={() => handleApproveUser(user.id)}
                        >
                          รออนุมัติ
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                       <div className="flex gap-1">
                         <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)}>
                           <Pencil className="w-4 h-4 text-primary" />
                         </Button>
                         {user.role === "student" && user.student_code && (
                           <Button
                             variant="ghost"
                             size="sm"
                             title="ลงทะเบียนใบหน้า"
                             onClick={() => setFaceRegisterUser(user)}
                           >
                             <ScanFace className="w-4 h-4 text-purple-600" />
                           </Button>
                         )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>ยืนยันการลบผู้ใช้</AlertDialogTitle>
                              <AlertDialogDescription>
                                คุณต้องการลบ {user.first_name} {user.last_name} ({user.email}) ใช่หรือไม่?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">ลบ</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* School Settings moved to /dashboard/admin/school-settings */}


      {/* Help Card */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="w-5 h-5 text-primary mt-0.5" />
            <div className="text-sm space-y-2">
              <p className="font-medium">วิธีนำเข้าข้อมูลจากไฟล์ DMC สพฐ.</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-0.5">
                <li>ดาวน์โหลดไฟล์ข้อมูลนักเรียนจากระบบ DMC ของ สพฐ. (รูปแบบ .xlsx หรือ .csv)</li>
                <li>กดปุ่ม <strong>"นำเข้าจากไฟล์ DMC"</strong> แล้วเลือกไฟล์</li>
                <li>ระบบจะจับคู่หัวข้อ DMC อัตโนมัติ (เลขประจำตัว, ชื่อ, นามสกุล, ระดับชั้น ฯลฯ)</li>
                <li>ตรวจสอบข้อมูลแล้วกดนำเข้า</li>
              </ol>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => downloadTemplate("student")}>
                  <Download className="w-4 h-4 mr-1" />ดาวน์โหลดฟอร์มนักเรียน
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadTemplate("teacher")}>
                  <Download className="w-4 h-4 mr-1" />ดาวน์โหลดฟอร์มบุคลากร
                </Button>
              </div>
              <p className="text-xs text-primary mt-2">💡 รองรับไฟล์ .xlsx, .xls, .csv — หัวข้อตรงตาม DMC สพฐ. ทั้งภาษาไทยและอังกฤษ</p>
              <p className="text-xs text-muted-foreground">💡 ครู/ผอ. จะมีข้อมูลตำแหน่งและวิทยฐานะ / นักเรียนจะถูกจัดเข้าห้องเรียนอัตโนมัติ</p>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="departments" className="mt-4">
          <DepartmentManagementPage />
        </TabsContent>
      </Tabs>

      {faceRegisterUser && (
        <FaceRegisterDialog
          open={!!faceRegisterUser}
          onOpenChange={(v) => { if (!v) setFaceRegisterUser(null); }}
          studentCode={faceRegisterUser.student_code}
          displayName={`${faceRegisterUser.prefix || ""}${faceRegisterUser.first_name} ${faceRegisterUser.last_name}`}
        />
      )}

      <Dialog open={deleteProgress.open} onOpenChange={(v) => { if (!v && deleteProgress.done) setDeleteProgress((p) => ({ ...p, open: false })); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => { if (!deleteProgress.done) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {deleteProgress.done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              )}
              {deleteProgress.done ? "ลบเสร็จสิ้น" : deleteProgress.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Progress value={deleteProgress.total > 0 ? (deleteProgress.current / deleteProgress.total) * 100 : 0} />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                ลบแล้ว <span className="font-semibold text-foreground">{deleteProgress.current}</span> จาก <span className="font-semibold text-foreground">{deleteProgress.total}</span> รายการ
              </span>
              {deleteProgress.failed > 0 && (
                <span className="text-destructive">ล้มเหลว {deleteProgress.failed}</span>
              )}
            </div>
            {!deleteProgress.done && (
              <p className="text-xs text-muted-foreground">กรุณารอจนกว่าจะดำเนินการเสร็จ อย่าปิดหน้าต่างนี้</p>
            )}
          </div>
          {deleteProgress.done && (
            <DialogFooter>
              <Button onClick={() => setDeleteProgress((p) => ({ ...p, open: false }))}>ปิด</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default UserManagement;
