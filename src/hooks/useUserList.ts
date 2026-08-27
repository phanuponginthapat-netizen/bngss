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
      // The admin list must come from the protected function. Reading user_roles
      // directly is intentionally RLS-scoped to the signed-in user and caused
      // other users to be inferred as teachers after a successful role change.
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const nextUsers = Array.isArray(data?.users)
        ? data.users.filter((user: UserItem) => Boolean(user?.id && user?.role))
        : [];
      setUsers(nextUsers as UserItem[]);
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
