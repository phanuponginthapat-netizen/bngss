import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export interface School {
  id: string;
  obec_code: string | null;
  school_code: string;
  school_name: string;
  short_name?: string | null;
  province: string | null;
  district: string | null;
  size_category?: string | null;
  is_active: boolean;
  total_students?: number | null;
  total_personnel?: number | null;
  director_name: string | null;
  logo_url: string | null;
}

/**
 * Returns the active school context for the current user (single-school).
 * School is read from profiles.school_id.
 */
export function useSchoolContext() {
  const { userId } = useUserRole();

  const profileQuery = useQuery({
    queryKey: ["user-school-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const schoolId = profileQuery.data?.school_id || null;

  const schoolQuery = useQuery({
    queryKey: ["school", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from("schools")
        .select("*")
        .eq("id", schoolId!)
        .maybeSingle();
      return data as unknown as School | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    school: schoolQuery.data || null,
    area: null,
    schoolId,
    areaId: null,
    isMultiSchool: false,
    loading: profileQuery.isPending || (!!schoolId && schoolQuery.isPending),
  };
}

/** Get all schools (admin only) */
export function useAllSchools() {
  return useQuery({
    queryKey: ["all-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .order("school_name");
      if (error) throw error;
      return (data || []) as unknown as School[];
    },
    staleTime: 60 * 1000,
  });
}
