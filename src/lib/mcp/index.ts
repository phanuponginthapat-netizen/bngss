import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listNewsTool from "./tools/list-news";
import listInboxTool from "./tools/list-inbox";

// Build the direct Supabase issuer from the project ref (Vite inlines this literal at build time).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "school-mcp",
  title: "School Management MCP",
  version: "0.1.0",
  instructions:
    "Tools for the school management system. Use `whoami` to identify the signed-in user, " +
    "`list_news` to fetch recent school news, and `list_my_notifications` to check the user's inbox.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listNewsTool, listInboxTool],
});
