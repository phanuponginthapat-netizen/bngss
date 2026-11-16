import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { fetchAllRows } from "@/lib/fetchAllRows";

export type ParentChild = {
  id: string;
  student_code: string;
  prefix: string | null;
  first_name: string;
  last_name: string;
  classroom_id: string | null;
};

/**
 * Resolve children linked to a parent account.
 * Source of truth = students.parent_user_id / parent_user_id_2 (same link used by
 * the RLS helper `is_parent_of`). Falls back to profiles.student_code for legacy
 * accounts that were linked by code only.
 */
export function useParentChildren() {
  const { userId, isParent, loading: roleLoading } = useUserRole();

  const q = useQuery({
    queryKey: ["parent-children", userId],
    enabled: !!userId && isParent,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ParentChild[]> => {
      if (!userId) return [];
      const cols = "id,student_code,prefix,first_name,last_name,classroom_id";

      const linked = await fetchAllRows<ParentChild>((from, to) => supabase
        .from("students")
        .select(cols)
        .or(`parent_user_id.eq.${userId},parent_user_id_2.eq.${userId}`).order("student_code").order("id").range(from, to));
      if (linked && linked.length > 0) return linked as ParentChild[];

      // Legacy fallback: profile carries the child's student_code
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("student_code")
        .eq("id", userId)
        .maybeSingle();
      if (profileError) throw profileError;

      const code = profile?.student_code?.trim();
      if (!code) return [];

      const { data, error } = await supabase.from("students").select(cols).eq("student_code", code);
      if (error) throw error;
      return (data ?? []) as ParentChild[];
    },
  });

  const children = q.data ?? [];
  const childIds = children.map((c) => c.id);

  return {
    isParent,
    children,
    childIds,
    error: q.error,
    refetch: q.refetch,
    isLoading: roleLoading || (isParent && q.isLoading),
  };
}
