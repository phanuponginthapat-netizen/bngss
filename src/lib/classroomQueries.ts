import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";

export function loadFullClassrooms() {
  return fetchAllRows((from, to) => supabase.from("classrooms").select("*")
    .order("grade_level").order("name").order("id").range(from, to));
}