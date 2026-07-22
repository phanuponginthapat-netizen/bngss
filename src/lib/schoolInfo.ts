import { supabase } from "@/integrations/supabase/client";

export async function getSchoolInfo(section_key: string) {
  const { data } = await (supabase as any)
    .from("cms_school_info")
    .select("*")
    .eq("section_key", section_key)
    .maybeSingle();
  return data;
}

