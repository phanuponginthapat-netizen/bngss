// One-time helper: copy storage objects from this project to an external Supabase project.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const { target_url, target_key, token } = await req.json();
  if (token !== Deno.env.get("MIGRATE_STORAGE_TOKEN")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const src = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const results: Record<string, unknown>[] = [];

  const { data: buckets } = await src.storage.listBuckets();
  for (const b of buckets ?? []) {
    const walk = async (prefix: string) => {
      const { data: items } = await src.storage.from(b.id).list(prefix, { limit: 1000 });
      for (const it of items ?? []) {
        const path = prefix ? `${prefix}/${it.name}` : it.name;
        if (!it.id) { await walk(path); continue; }
        const { data: blob, error } = await src.storage.from(b.id).download(path);
        if (error || !blob) { results.push({ bucket: b.id, path, error: error?.message }); continue; }
        const res = await fetch(`${target_url}/storage/v1/object/${b.id}/${encodeURI(path)}`, {
          method: "POST",
          headers: {
            apikey: target_key,
            Authorization: `Bearer ${target_key}`,
            "Content-Type": it.metadata?.mimetype ?? "application/octet-stream",
            "x-upsert": "true",
          },
          body: new Uint8Array(await blob.arrayBuffer()),
        });
        results.push({ bucket: b.id, path, status: res.status, body: res.ok ? undefined : (await res.text()).slice(0, 160) });
      }
    };
    await walk("");
  }
  const failed = results.filter((r) => r.error || (typeof r.status === "number" && r.status >= 300));
  return new Response(JSON.stringify({ total: results.length, failed }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
