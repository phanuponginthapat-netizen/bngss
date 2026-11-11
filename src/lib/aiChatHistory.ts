import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "./fetchAllRows";

export async function loadAiChatHistory(userId: string) {
  return fetchAllRows<{ id: string; role: string; content: string; created_at: string }>((from, to) =>
    supabase.from("ai_chat_logs").select("id,role,content,created_at")
      .eq("user_id", userId).in("role", ["user", "assistant"])
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to),
    { pageSize: 500 },
  );
}