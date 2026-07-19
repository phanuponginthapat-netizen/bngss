import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { todayBangkok, bkkDateISO } from "@/lib/dateBE";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_homework",
  title: "List my homework",
  description:
    "List homework assignments visible to the signed-in user, ordered by due date (upcoming first).",
  inputSchema: {
    only_open: z.boolean().default(true).describe("Only assignments not past due"),
    limit: z.number().int().min(1).max(100).default(30),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_open, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = sb(ctx)
      .from("homework_assignments")
      .select("id, title, description, subject_id, due_date, classroom_id, created_at")
      .order("due_date", { ascending: true })
      .limit(limit);
    if (only_open) q = q.gte("due_date", todayBangkok());
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { items: data },
    };
  },
});
