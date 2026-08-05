import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listNewsTool from "./tools/list-news";
import listInboxTool from "./tools/list-inbox";
import listAttendanceTool from "./tools/list-my-attendance";
import listHomeworkTool from "./tools/list-my-homework";
import listGradesTool from "./tools/list-my-grades";
import listEformsTool from "./tools/list-my-eforms";
import listLeavesTool from "./tools/list-my-leaves";
import listScheduleTool from "./tools/list-my-schedule";

const backendUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const projectRef = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) || "project-ref-unset";

export default defineMcp({
  name: "school-mcp",
  title: "School Management MCP",
  version: "0.2.0",
  instructions:
    "Tools for the school management system. Use `whoami` for identity, `list_news` for school news, " +
    "`list_my_notifications` for inbox, `list_my_attendance` / `list_my_homework` / `list_my_grades` / " +
    "`list_my_eforms` / `list_my_leaves` / `list_my_schedule` for personal academic data. All results " +
    "are RLS-scoped to the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `${backendUrl || `https://${projectRef}.supabase.co`}/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listNewsTool,
    listInboxTool,
    listAttendanceTool,
    listHomeworkTool,
    listGradesTool,
    listEformsTool,
    listLeavesTool,
    listScheduleTool,
  ],
});
