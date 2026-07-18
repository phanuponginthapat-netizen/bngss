import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

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
 * Parent ↔ child relationship is via profiles.student_code → students.student_code.
 * Returns `{ childIds, children, isLoading, isParent }`.
 *
 * For non-parent roles, returns empty/false — pages can branch by role.
 */
export function useParentChildren() {
  const { userId, isParent, loading: roleLoading } = useUserRole();

  const q = useQuery({
    queryKey: ["parent-children", userId],
    enabled: !!userId && isParent,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ParentChild[]> => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("student_code")
        .eq("id", userId!)
        .maybeSingle();

      const code = profile?.student_code?.trim();
      if (!code) return [];

      const { data, error } = await supabase
        .from("students")
        .select("id,student_code,prefix,first_name,last_name,classroom_id")
        .eq("student_code", code);

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
    isLoading: roleLoading || (isParent && q.isLoading),
  };
}
