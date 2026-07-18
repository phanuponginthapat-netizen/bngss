// Deletes chat messages + attachments older than 30 days
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Collect attachments to delete from storage
  const { data: oldMsgs } = await supabase
    .from("chat_messages")
    .select("id, attachments")
    .lt("created_at", cutoff)
    .limit(1000);

  const paths: string[] = [];
  for (const m of oldMsgs || []) {
    for (const a of (m.attachments as any[]) || []) {
      if (a?.path) paths.push(a.path);
    }
  }

  if (paths.length) {
    // remove in chunks of 100
    for (let i = 0; i < paths.length; i += 100) {
      await supabase.storage.from("chat-attachments").remove(paths.slice(i, i + 100));
    }
  }

  // 2. Delete messages
  const { error, count } = await supabase
    .from("chat_messages")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  return new Response(
    JSON.stringify({ ok: !error, deleted_messages: count || 0, deleted_files: paths.length, error: error?.message }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
