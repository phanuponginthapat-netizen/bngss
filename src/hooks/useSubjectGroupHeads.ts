import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export type SubjectGroup =
  | "thai" | "math" | "science" | "social"
  | "health_pe" | "arts" | "occupation" | "foreign_lang" | "special_ed";

/**
 * Returns the subject groups for which the current user is the head.
 * Admin / director are treated as head of every group.
 */
export function useSubjectGroupHeads() {
  const { userId, role, loading: roleLoading } = useUserRole();
  const isPrivileged = role === "admin" || role === "director";

  const q = useQuery({
    queryKey: ["my-subject-group-heads", userId],
    enabled: !!userId && !isPrivileged,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_group_heads")
        .select("subject_group")
        .eq("user_id", userId!);
      if (error) return [];
      return (data || []).map((d: any) => d.subject_group as SubjectGroup);
    },
  });

  const groups: SubjectGroup[] = isPrivileged
    ? ["thai", "math", "science", "social", "health_pe", "arts", "occupation", "foreign_lang", "special_ed"]
    : q.data || [];

  return {
    groups,
    isHeadOf: (g: SubjectGroup) => isPrivileged || groups.includes(g),
    isAnyHead: groups.length > 0,
    isPrivileged,
    loading: roleLoading || (!isPrivileged && q.isLoading),
  };
}
