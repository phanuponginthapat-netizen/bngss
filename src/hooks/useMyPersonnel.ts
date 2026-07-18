import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "./useAuthSession";

/**
 * Returns the personnel record linked to the currently authenticated user,
 * plus current academic year & semester convenience fields.
 */
export function useMyPersonnel() {
  const { session } = useAuthSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["my-personnel", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });
}
