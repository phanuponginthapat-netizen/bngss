import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import type { DeptRole } from "./useUserDepartments";

/** 8 กลุ่มสาระการเรียนรู้ + กิจกรรมพัฒนาผู้เรียน (มาตรฐาน สพฐ.) */
export const SUBJECT_GROUPS = [
  "ภาษาไทย",
  "คณิตศาสตร์",
  "วิทยาศาสตร์และเทคโนโลยี",
  "สังคมศึกษา ศาสนา และวัฒนธรรม",
  "สุขศึกษาและพลศึกษา",
  "ศิลปะ",
  "การงานอาชีพ",
  "ภาษาต่างประเทศ",
  "กิจกรรมพัฒนาผู้เรียน",
] as const;

export type SubjectGroup = (typeof SUBJECT_GROUPS)[number];

export const SUBJECT_GROUP_COLORS: Record<string, string> = {
  "ภาษาไทย": "from-rose-500/20 to-pink-500/10 border-rose-500/30",
  "คณิตศาสตร์": "from-blue-500/20 to-cyan-500/10 border-blue-500/30",
  "วิทยาศาสตร์และเทคโนโลยี": "from-emerald-500/20 to-green-500/10 border-emerald-500/30",
  "สังคมศึกษา ศาสนา และวัฒนธรรม": "from-amber-500/20 to-orange-500/10 border-amber-500/30",
  "สุขศึกษาและพลศึกษา": "from-teal-500/20 to-cyan-500/10 border-teal-500/30",
  "ศิลปะ": "from-purple-500/20 to-fuchsia-500/10 border-purple-500/30",
  "การงานอาชีพ": "from-orange-500/20 to-amber-500/10 border-orange-500/30",
  "ภาษาต่างประเทศ": "from-indigo-500/20 to-violet-500/10 border-indigo-500/30",
  "กิจกรรมพัฒนาผู้เรียน": "from-slate-500/20 to-gray-500/10 border-slate-500/30",
};

export function useUserSubjectGroups() {
  const { userId, role, loading: roleLoading } = useUserRole();
  const isPrivileged = role === "admin" || role === "director";

  const q = useQuery({
    queryKey: ["my-subject-groups", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_subject_groups")
        .select("subject_group, group_role")
        .eq("user_id", userId!);
      if (error) return [];
      return (data || []) as { subject_group: string; group_role: DeptRole }[];
    },
  });

  const list = q.data || [];
  const groups = list.map((r) => r.subject_group);
  const roleMap = new Map(list.map((r) => [r.subject_group, r.group_role]));

  return {
    groups,
    roleIn: (g: string): DeptRole | null =>
      isPrivileged ? "head" : roleMap.get(g) ?? null,
    isHeadOf: (g: string) => isPrivileged || roleMap.get(g) === "head" || roleMap.get(g) === "deputy_head",
    isPrivileged,
    loading: roleLoading || q.isLoading,
  };
}
