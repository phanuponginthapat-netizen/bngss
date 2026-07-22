import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

const ADMIN_ROLES = ["admin", "director", "super_admin", "school_admin"];
const ALLOWED_BUCKETS = new Set(["cms-images"]);
const MAX_BYTES = 5 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sanitizeStorageKey = (key: string): string => {
  const segments = key.split("/").map((seg) =>
    seg
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[._-]+|[._-]+$/g, ""),
  );
  const cleaned = segments.filter(Boolean).join("/");
  return cleaned || `file_${Date.now()}`;
};

const base64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: roleRows, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ADMIN_ROLES);

    if (roleError) {
      console.error("upload-cms-image role check failed", roleError);
      return json({ error: "role_check_failed" }, 500);
    }
    if (!roleRows?.length) return json({ error: "admin_required" }, 403);

    const body = await req.json().catch(() => null) as {
      bucket?: string;
      path?: string;
      base64?: string;
      contentType?: string;
      upsert?: boolean;
    } | null;

    const bucket = body?.bucket ?? "";
    const rawPath = body?.path ?? "";
    const base64 = body?.base64 ?? "";
    const contentType = body?.contentType ?? "application/octet-stream";

    if (!ALLOWED_BUCKETS.has(bucket)) return json({ error: "bucket_not_allowed" }, 400);
    if (!rawPath || !base64) return json({ error: "path_and_file_required" }, 400);
    if (!contentType.startsWith("image/")) return json({ error: "image_required" }, 400);

    const bytes = base64ToBytes(base64);
    if (bytes.byteLength > MAX_BYTES) return json({ error: "file_too_large" }, 413);

    const path = sanitizeStorageKey(rawPath);
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, bytes, {
      contentType,
      upsert: body?.upsert ?? true,
    });

    if (uploadError) {
      console.error("upload-cms-image storage upload failed", uploadError);
      return json({ error: uploadError.message }, 500);
    }

    const { data } = admin.storage.from(bucket).getPublicUrl(path);
    return json({ path, publicUrl: data.publicUrl });
  } catch (error) {
    console.error("upload-cms-image failed", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});