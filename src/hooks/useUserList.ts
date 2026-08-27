// Central user list loader for the admin User Management page.
// Aggregates profiles + user_roles + personnel + students into a single UserItem[].
// Extracted from src/pages/UserManagement.tsx.

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { swal } from "@/lib/swal";
import type { AppRole } from "@/hooks/useUserRole";

const ROLE_PRIORITY: AppRole[] = [
  "admin",
  "director",
  "teacher",
  "parent",
  "student",
  "alumni",
  "observer",
];

function pickPrimaryRole(roles: AppRole[]): AppRole | null {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) ?? roles[0] ?? null;
}

export interface UserItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  department: string;
  student_code: string;
  employee_code: string;
  created_at: string;
  prefix?: string;
  position_title?: string;
  academic_standing?: string;
  subject_group?: string;
  is_approved?: boolean;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  nickname?: string;
  classroom_id?: string | null;
  classroom_name?: string;
  grade_level?: string;
  student_status?: string;
}

export function useUserList() {
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, profilesRes, personnelRes, studentsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("id, first_name, last_name, department, student_code, employee_code, position_title, gender, phone, date_of_birth, is_approved, nickname, google_email"),
        supabase.from("personnel").select("user_id, email, prefix, position, academic_standing, subject_group"),
        supabase.from("students").select("auth_user_id, auth_email, student_code, prefix, classroom_id, status, classrooms!students_classroom_id_fkey(id, name, grade_level)"),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (personnelRes.error) throw personnelRes.error;
      if (studentsRes.error) throw studentsRes.error;

      const rolesByUser = new Map<string, AppRole[]>();
      for (const row of rolesRes.data || []) {
        const current = rolesByUser.get(row.user_id) || [];
        current.push(row.role as AppRole);
        rolesByUser.set(row.user_id, current);
      }
      const roleMap = new Map(
        [...rolesByUser.entries()].map(([userId, roles]) => [userId, pickPrimaryRole(roles)]),
      );
      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const personnelMap = new Map((personnelRes.data || []).filter((p: any) => p.user_id).map((p: any) => [p.user_id, p]));
      const studentByAuthMap = new Map((studentsRes.data || []).filter((s: any) => s.auth_user_id).map((s: any) => [s.auth_user_id, s]));

      const userIds = new Set<string>([
        ...(rolesRes.data || []).map((r: any) => r.user_id),
        ...(profilesRes.data || []).map((p: any) => p.id),
        ...(personnelRes.data || []).map((p: any) => p.user_id).filter(Boolean),
        ...(studentsRes.data || []).map((s: any) => s.auth_user_id).filter(Boolean),
      ]);

      const nextUsers: UserItem[] = Array.from(userIds).map((userId) => {
        const profile: any = profileMap.get(userId);
        const personnel: any = personnelMap.get(userId);
        const stu: any = studentByAuthMap.get(userId);
        const role = roleMap.get(userId) || (stu ? "student" : personnel ? "teacher" : null);
        if (!role) return null;

        return {
          id: userId,
          email: personnel?.email || stu?.auth_email || profile?.google_email || "",
          first_name: profile?.first_name || "",
          last_name: profile?.last_name || "",
          role,
          department: profile?.department || "",
          student_code: profile?.student_code || stu?.student_code || "",
          employee_code: profile?.employee_code || "",
          created_at: "",
          prefix: personnel?.prefix || stu?.prefix || "",
          position_title: personnel?.position || profile?.position_title || "",
          academic_standing: personnel?.academic_standing || "",
          subject_group: personnel?.subject_group || "",
          is_approved: profile?.is_approved ?? false,
          phone: profile?.phone || "",
          gender: profile?.gender || "",
          date_of_birth: profile?.date_of_birth || "",
          nickname: profile?.nickname || "",
          classroom_id: stu?.classroom_id || null,
          classroom_name: stu?.classrooms?.name || "",
          grade_level: stu?.classrooms?.grade_level || (role === "student" ? profile?.department || "" : ""),
          student_status: stu?.status || "",
        };
      }).filter(Boolean) as UserItem[];

      setUsers(nextUsers);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_roles"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    } catch (e: any) {
      swal.error(e.message || "Failed to load users");
    }
    setLoading(false);
  }, [queryClient]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    // Map short grade code (e.g. "ม.3") → full Thai form ("มัธยมศึกษาปีที่ 3")
    const expandGrade = (g: string): string[] => {
      if (!g || g === "all") return [];
      const m = g.match(/^(อ|ป|ม)\.(\d+)$/);
      if (!m) return [g];
      const prefix = m[1] === "อ" ? "อนุบาลปีที่" : m[1] === "ป" ? "ประถมศึกษาปีที่" : "มัธยมศึกษาปีที่";
      return [g, `${prefix} ${m[2]}`];
    };
    const gradeVariants = expandGrade(filterGrade);
    return users.filter((u) => {
      const matchSearch =
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.student_code?.toLowerCase().includes(q) ||
        u.employee_code?.toLowerCase().includes(q);
      const matchRole = filterRole === "all" || u.role === filterRole;
      const matchGrade =
        filterGrade === "all" ||
        gradeVariants.includes(u.department || "") ||
        gradeVariants.includes(u.grade_level || "");
      return matchSearch && matchRole && matchGrade;
    });
  }, [users, search, filterRole, filterGrade]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === 0) return new Set(filteredUsers.map(u => u.id));
      return new Set();
    });
  }, [filteredUsers]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return {
    users, setUsers,
    loading,
    fetchUsers,
    search, setSearch,
    filterRole, setFilterRole,
    filterGrade, setFilterGrade,
    filteredUsers,
    selectedIds, setSelectedIds,
    toggleSelect, toggleSelectAll, clearSelection,
  };
}
