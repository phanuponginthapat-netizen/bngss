import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { BlobWriter, TextReader, ZipWriter } from "https://deno.land/x/zipjs@v2.7.32/index.js";
import { rateLimit } from "../_shared/rateLimit.ts";

import { buildCorsHeaders } from "../_shared/cors.ts";
const corsHeaders = buildCorsHeaders([], "POST, GET, OPTIONS");

// Tables to snapshot — order doesn't matter, all dumped as CSV
const TABLES = [
  "schools",
  "profiles",
  "user_roles",
  "personnel",
  "students",
  "classrooms",
  "subjects",
  "schedules",
  "enrollments",
  "attendance",
  "behavior_records",
  "student_leaves",
  "staff_leaves",
  "health_records",
  "health_measurements",
  "student_screenings",
  "documents",
  "eforms",
  "news_posts",
  "budget_transactions",
  "assets",
  "ict_devices",
  "ict_loans",
  "procurement_records",
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set()),
  );
  const out = [keys.join(",")];
  for (const r of rows) out.push(keys.map((k) => csvEscape(r[k])).join(","));
  return out.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rl = await rateLimit(req, { name: "backup-snapshot", limit: 3, windowMs: 60_000 });
  if (rl.blocked && rl.response) return rl.response;

  // Verify caller is admin/director via their JWT
  const auth = req.headers.get("authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
  const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "director");
  if (!allowed) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const zipBlob = new BlobWriter("application/zip");
  const zip = new ZipWriter(zipBlob);

  const summary: Record<string, number | string> = {
    generated_at: new Date().toISOString(),
    generated_by: user.email ?? user.id,
  };

  for (const table of TABLES) {
    try {
      // page through to bypass 1000-row limit
      const all: Record<string, unknown>[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await sb.from(table).select("*").range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as Record<string, unknown>[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      summary[table] = all.length;
      await zip.add(`${table}.csv`, new TextReader(rowsToCsv(all)));
    } catch (e) {
      summary[table] = `ERROR: ${(e as Error).message}`;
      await zip.add(`${table}.error.txt`, new TextReader(String((e as Error).message)));
    }
  }

  await zip.add("_summary.json", new TextReader(JSON.stringify(summary, null, 2)));
  await zip.close();
  const blob = await zipBlob.getData();

  const filename = `school-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  return new Response(blob, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
