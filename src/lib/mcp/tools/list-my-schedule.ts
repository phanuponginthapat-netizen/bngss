import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_schedule",
  title: "List my schedule",
  description: "List class schedule entries visible to the signed-in user.",
  inputSchema: {
    day_of_week: z
      .number()
      .int()
      .min(0)
      .max(6)
      .optional()
      .describe("0=Sunday .. 6=Saturday"),
    limit: z.number().int().min(1).max(200).default(60),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ day_of_week, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = sb(ctx)
      .from("schedules")
      .select("id, classroom_id, subject_id, teacher_id, day_of_week, period, start_time, end_time, room")
      .order("day_of_week", { ascending: true })
      .order("period", { ascending: true })
      .limit(limit);
    if (day_of_week !== undefined) q = q.eq("day_of_week", day_of_week);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { items: data },
    };
  },
});
