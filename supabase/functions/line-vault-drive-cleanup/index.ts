// Processes public.line_vault_drive_trash: permanently deletes queued Google
// Drive files. Runs via pg_cron every 5 minutes. Also supports ?scan=1 to
// sweep the LineVault Drive folder tree for orphans (files whose IDs are no
// longer referenced by any line_vault_items row) and enqueue them.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { deleteFile, driveFetch } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

  // Allow: cron header, or admin JWT
  const cronOk = CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET;
  const admin = createClient(SUPABASE_URL, SERVICE);
  if (!cronOk) {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
    const isAdmin = (roles || []).some((r: any) => ["admin", "director"].includes(r.role));
    if (!isAdmin) return json({ error: "admin_required" }, 403);
  }

  const url = new URL(req.url);
  const doScan = url.searchParams.get("scan") === "1";

  const stats: any = { processed: 0, failed: 0, scanned_orphans: 0 };

  // ---- Optional scan for orphan Drive files ----
  if (doScan) {
    try {
      // Collect all folder ids under Drive roots configured on groups + default "LineVault" tree
      const { data: groups } = await admin
        .from("line_vault_groups")
        .select("drive_folder_id, drive_root_folder_id");
      const roots = new Set<string>();
      for (const g of (groups || [])) {
        if (g.drive_folder_id) roots.add(g.drive_folder_id);
        if (g.drive_root_folder_id) roots.add(g.drive_root_folder_id);
      }
      // Also search the default "LineVault" tree by name
      const defaultRootRes = await driveFetch(
        `/drive/v3/files?q=${encodeURIComponent(
          "mimeType='application/vnd.google-apps.folder' and name='LineVault' and 'root' in parents and trashed=false",
        )}&fields=files(id,name)&pageSize=5`,
      );
      if (defaultRootRes.ok) {
        const dj = await defaultRootRes.json();
        for (const f of (dj.files || [])) roots.add(f.id);
      }

      const knownIds = new Set<string>();
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await admin
          .from("line_vault_items")
          .select("drive_file_id")
          .not("drive_file_id", "is", null)
          .range(from, from + pageSize - 1);
        if (error) break;
        for (const r of data || []) knownIds.add((r as any).drive_file_id);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }

      // Recursively list files under each root
      async function walk(folderId: string) {
        let pageToken: string | undefined;
        while (true) {
          const q = `'${folderId}' in parents and trashed=false`;
          const usp = new URLSearchParams({
            q,
            fields: "nextPageToken, files(id,name,mimeType,createdTime)",
            pageSize: "1000",
          });
          if (pageToken) usp.set("pageToken", pageToken);
          const res = await driveFetch(`/drive/v3/files?${usp}`);
          if (!res.ok) break;
          const j = await res.json();
          for (const f of (j.files || [])) {
            if (f.mimeType === "application/vnd.google-apps.folder") {
              await walk(f.id);
            } else if (!knownIds.has(f.id)) {
              // Only orphan-queue files older than 10 minutes to avoid racing fresh uploads
              const age = Date.now() - Date.parse(f.createdTime || "");
              if (age > 10 * 60_000) {

                try {
                  await admin.from("line_vault_drive_trash")
                    .insert({ drive_file_id: f.id, status: "pending" });
                  stats.scanned_orphans++;
                } catch (_) { /* ignore */ }
              }
            }
          }
          pageToken = j.nextPageToken;
          if (!pageToken) break;
        }
      }
      for (const root of roots) {
        try { await walk(root); } catch (e) { console.error("[scan walk]", e); }
      }
    } catch (e) {
      console.error("[scan]", e);
    }
  }

  // ---- Process pending trash queue ----
  const { data: pending } = await admin
    .from("line_vault_drive_trash")
    .select("id, drive_file_id, attempts")
    .eq("status", "pending")
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(200);

  for (const row of (pending || [])) {
    try {
      await deleteFile(row.drive_file_id);
      await admin.from("line_vault_drive_trash")
        .update({ status: "deleted", processed_at: new Date().toISOString() })
        .eq("id", row.id);
      stats.processed++;
    } catch (e: any) {
      const msg = String(e?.message || e);
      const isGone = /404|not\s*found/i.test(msg);
      await admin.from("line_vault_drive_trash").update({
        status: isGone ? "gone" : "pending",
        attempts: (row.attempts ?? 0) + 1,
        last_error: msg.slice(0, 500),
        processed_at: isGone ? new Date().toISOString() : null,
      }).eq("id", row.id);
      if (!isGone) stats.failed++;
    }
  }

  return json({ ok: true, ...stats });
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
