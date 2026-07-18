// E-Learning content proxy: serves files from private storage bucket
// URL format: /functions/v1/learning-proxy/{contentId}/{path...}
// - public visibility → no auth required
// - school visibility → requires JWT belonging to same school
// Streams file with proper Content-Type & CORS so iframe relative paths work.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  wasm: "application/wasm",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  swf: "application/x-shockwave-flash",
  map: "application/json; charset=utf-8",
};

function mimeOf(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Path: /learning-proxy/{contentId}/{...filePath}
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("learning-proxy");
    if (idx === -1 || parts.length < idx + 2) {
      return new Response("Bad request", { status: 400, headers: corsHeaders });
    }
    const contentId = parts[idx + 1];
    const filePath = parts.slice(idx + 2).join("/") || "";

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: content, error: contentErr } = await admin
      .from("learning_contents")
      .select("id, school_id, visibility, is_active, storage_path, entry_file, kind")
      .eq("id", contentId)
      .maybeSingle();

    if (contentErr || !content || !content.is_active) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }
    if (!["html_single", "html_zip", "pdf", "flash_swf"].includes(content.kind)) {
      return new Response("Not a hosted resource", { status: 400, headers: corsHeaders });
    }

    // Auth check
    if (content.visibility !== "public") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const tokenFromQuery = url.searchParams.get("token") ?? "";
      const jwt = (authHeader.replace(/^Bearer\s+/i, "") || tokenFromQuery).trim();
      if (!jwt) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: udata } = await userClient.auth.getUser();
      if (!udata?.user) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      const { data: prof } = await admin
        .from("profiles")
        .select("school_id")
        .eq("id", udata.user.id)
        .maybeSingle();
      if (!prof || prof.school_id !== content.school_id) {
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
    }

    // Resolve storage object key
    // storage_path is the folder prefix e.g. "abc-id"
    const base = (content.storage_path || contentId).replace(/\/+$/, "");
    let objectKey: string;
    if (!filePath || filePath === "") {
      // serve entry file
      objectKey = `${base}/${content.entry_file || "index.html"}`;
    } else {
      objectKey = `${base}/${filePath}`;
    }

    const { data: blob, error: dlErr } = await admin.storage
      .from("learning-content")
      .download(objectKey);

    if (dlErr || !blob) {
      return new Response("File not found", { status: 404, headers: corsHeaders });
    }

    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": mimeOf(objectKey),
        "Cache-Control": "public, max-age=300",
        // allow iframe usage from any origin in our app
        "X-Frame-Options": "ALLOWALL",
      },
    });
  } catch (e) {
    return new Response(`Error: ${(e as Error).message}`, { status: 500, headers: corsHeaders });
  }
});
