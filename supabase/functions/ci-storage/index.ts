// CI-only gateway for the private app-downloads bucket.
// GitHub Actions authenticates with the CI_UPLOAD_TOKEN secret (x-ci-token header);
// normal app users can no longer write/delete APKs directly.
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "app-downloads";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const validPath = (p: unknown): p is string =>
  typeof p === "string" && /^[A-Za-z0-9._-][A-Za-z0-9._/-]{0,200}$/.test(p) && !p.includes("..");

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const expected = Deno.env.get("CI_UPLOAD_TOKEN") ?? "";
  const given = req.headers.get("x-ci-token") ?? "";
  if (expected.length < 24 || !safeEqual(given, expected)) return json({ error: "unauthorized" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const store = admin.storage.from(BUCKET);

  switch (body.action) {
    case "sign_upload": {
      if (!validPath(body.path)) return json({ error: "invalid_path" }, 400);
      const { data, error } = await store.createSignedUploadUrl(body.path, { upsert: true });
      return error ? json({ error: error.message }, 500) : json(data);
    }
    case "list": {
      const { data, error } = await store.list(typeof body.prefix === "string" ? body.prefix : "", {
        limit: Math.min(Number(body.limit) || 1000, 1000),
        offset: Number(body.offset) || 0,
        sortBy: { column: "name", order: "asc" },
      });
      return error ? json({ error: error.message }, 500) : json(data);
    }
    case "head": {
      if (!validPath(body.path)) return json({ error: "invalid_path" }, 400);
      const { data, error } = await store.download(body.path);
      return error || !data ? json({ error: error?.message ?? "missing" }, 404) : json({ size: data.size });
    }
    case "delete": {
      const paths = Array.isArray(body.paths) ? body.paths.filter(validPath) : [];
      if (!paths.length || paths.length > 100) return json({ error: "invalid_paths" }, 400);
      const { data, error } = await store.remove(paths);
      return error ? json({ error: error.message }, 500) : json(data);
    }
    default:
      return json({ error: "unknown_action" }, 400);
  }
});
