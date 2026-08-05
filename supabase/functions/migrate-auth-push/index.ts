// Temporary migration helper: pushes auth.users + auth.identities from this
// project into an external Supabase instance via its exec_restore_sql RPC.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { target_url, target_key } = await req.json();
    if (!target_url || !target_key) throw new Error("target_url and target_key required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const exec = async (sql: string) => {
      const r = await fetch(`${target_url}/rest/v1/rpc/exec_restore_sql`, {
        method: "POST",
        headers: { apikey: target_key, Authorization: `Bearer ${target_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ _sql: sql }),
      });
      if (!r.ok) throw new Error(`[${r.status}] ${await r.text()}`);
    };

    const dump = async (table: string) => {
      const { data, error } = await admin.rpc("mig_dump_auth", { _table: table });
      if (error) throw new Error(`${table}: ${error.message}`);
      return (data ?? []) as unknown[];
    };

    let total = 0;
    for (const table of ["users", "identities"]) {
      const rows = await dump(table);
      // `confirmed_at` is a generated column in auth.users and cannot be written.
      const GENERATED = new Set(["confirmed_at"]);
      const clean = (rows as Record<string, unknown>[]).map((r) => {
        const o: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) if (!GENERATED.has(k)) o[k] = v;
        return o;
      });
      const cols = clean.length ? Object.keys(clean[0]) : [];
      const colList = cols.map((c) => `"${c}"`).join(", ");
      for (let i = 0; i < clean.length; i += 100) {
        const chunk = JSON.stringify(clean.slice(i, i + 100));
        await exec(
          `insert into auth.${table} (${colList}) select ${colList} from json_populate_recordset(null::auth.${table}, $mig$${chunk}$mig$) on conflict (id) do nothing;`,
        );
      }

      total += rows.length;
      console.log(`pushed ${table}: ${rows.length}`);
    }

    return new Response(JSON.stringify({ ok: true, total }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("migrate-auth-push failed:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
