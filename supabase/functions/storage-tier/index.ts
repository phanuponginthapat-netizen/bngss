import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { downloadFile, ensureFolderPath, uploadFile, deleteFile as deleteDriveFile } from "../_shared/googleDrive.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(corsHeaders);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let action = "usage";
    let params: Record<string, any> = {};

    if (req.method === "GET") {
      const url = new URL(req.url);
      action = url.searchParams.get("action") || "usage";
      params = {
        bucket: url.searchParams.get("bucket"),
        path: url.searchParams.get("path"),
        id: url.searchParams.get("id"),
      };
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      action = body.action || "usage";
      params = body;
    }

    // -------------------------------------------------------------
    // 1. ACTION: FETCH (Stream file directly from Drive)
    // -------------------------------------------------------------
    if (action === "fetch") {
      const { bucket, path, id } = params;
      let registryRow: any = null;

      if (id) {
        const { data } = await supabaseAdmin.from("cold_storage_registry").select("*").eq("id", id).maybeSingle();
        registryRow = data;
      } else if (bucket && path) {
        const { data } = await supabaseAdmin
          .from("cold_storage_registry")
          .select("*")
          .eq("bucket_name", bucket)
          .eq("file_path", path)
          .maybeSingle();
        registryRow = data;
      }

      if (!registryRow || !registryRow.drive_file_id) {
        return json({ error: "File not found in cold storage registry" }, 404);
      }

      const driveRes = await downloadFile(registryRow.drive_file_id);
      if (!driveRes.ok) {
        return json({ error: `Failed to download from Drive [${driveRes.status}]` }, driveRes.status);
      }

      const contentType = registryRow.mime_type || driveRes.headers.get("content-type") || "application/octet-stream";
      return new Response(driveRes.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
          "Content-Disposition": `inline; filename="${encodeURIComponent(registryRow.file_path.split("/").pop() || "file")}"`,
        },
      });
    }

    // -------------------------------------------------------------
    // 2. ACTION: USAGE (Report storage footprint across Supabase & Drive)
    // -------------------------------------------------------------
    if (action === "usage") {
      // Get offloaded cold storage metrics
      const { data: coldRows = [] } = await supabaseAdmin
        .from("cold_storage_registry")
        .select("id, bucket_name, size_bytes, offloaded_at");

      const offloadedBytes = (coldRows || []).reduce((sum, r) => sum + Number(r.size_bytes || 0), 0);
      const offloadedCount = (coldRows || []).length;

      // Group offloaded by bucket
      const coldByBucket: Record<string, { count: number; bytes: number }> = {};
      (coldRows || []).forEach((r) => {
        const b = r.bucket_name || "unknown";
        if (!coldByBucket[b]) coldByBucket[b] = { count: 0, bytes: 0 };
        coldByBucket[b].count += 1;
        coldByBucket[b].bytes += Number(r.size_bytes || 0);
      });

      // Get Supabase Storage buckets
      const { data: buckets = [] } = await supabaseAdmin.storage.listBuckets();
      const bucketStats: Array<{
        name: string;
        public: boolean;
        supabase_files: number;
        supabase_bytes: number;
        drive_files: number;
        drive_bytes: number;
      }> = [];

      let totalSupabaseBytes = 0;
      let totalSupabaseFiles = 0;

      for (const b of buckets || []) {
        // List top objects
        const { data: objects = [] } = await supabaseAdmin.storage.from(b.name).list("", { limit: 1000 });
        let bBytes = 0;
        let bFiles = 0;

        for (const obj of objects || []) {
          if (obj.id) {
            bFiles += 1;
            bBytes += obj.metadata?.size || 0;
          }
        }

        totalSupabaseBytes += bBytes;
        totalSupabaseFiles += bFiles;

        const coldInfo = coldByBucket[b.name] || { count: 0, bytes: 0 };
        bucketStats.push({
          name: b.name,
          public: b.public,
          supabase_files: bFiles,
          supabase_bytes: bBytes,
          drive_files: coldInfo.count,
          drive_bytes: coldInfo.bytes,
        });
      }

      return json({
        supabase_total_bytes: totalSupabaseBytes,
        supabase_total_files: totalSupabaseFiles,
        drive_total_bytes: offloadedBytes,
        drive_total_files: offloadedCount,
        target_under_1gb: totalSupabaseBytes < 1024 * 1024 * 1024,
        buckets: bucketStats,
      });
    }

    // -------------------------------------------------------------
    // 3. ACTION: OFFLOAD (Download Supabase -> Upload Drive -> Save Registry -> Remove Supabase)
    // -------------------------------------------------------------
    if (action === "offload") {
      const targetBuckets: string[] = params.buckets || [];
      const maxFiles: number = params.max_files || 50;

      const { data: buckets = [] } = await supabaseAdmin.storage.listBuckets();
      const activeBuckets = targetBuckets.length
        ? buckets.filter((b) => targetBuckets.includes(b.name))
        : buckets;

      let totalFreedBytes = 0;
      let totalOffloadedCount = 0;
      const results: Array<{ bucket: string; path: string; drive_id: string; size: number; error?: string }> = [];

      for (const b of activeBuckets) {
        if (totalOffloadedCount >= maxFiles) break;

        // Recursive list or top level list
        const { data: objects = [] } = await supabaseAdmin.storage.from(b.name).list("", { limit: 100 });
        
        for (const obj of objects || []) {
          if (totalOffloadedCount >= maxFiles) break;
          if (!obj.name || obj.name.endsWith("/")) continue;

          const filePath = obj.name;
          const fileSize = obj.metadata?.size || 0;
          const mimeType = obj.metadata?.mimetype || "application/octet-stream";

          try {
            // 1. Download from Supabase Storage
            const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from(b.name).download(filePath);
            if (dlErr || !fileData) {
              throw new Error(`Download from Supabase failed: ${dlErr?.message || "No data"}`);
            }

            const arrayBuffer = await fileData.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);

            // 2. Prepare Google Drive folder path ["BNGSS Storage", bucketName]
            const folderId = await ensureFolderPath(["BNGSS Storage", b.name]);
            const fileName = filePath.split("/").pop() || filePath;

            // 3. Upload to Google Drive
            const driveFile = await uploadFile(fileName, mimeType, bytes, folderId);

            // 4. Save entry to cold_storage_registry
            const { error: regErr } = await supabaseAdmin.from("cold_storage_registry").upsert(
              {
                bucket_name: b.name,
                file_path: filePath,
                drive_file_id: driveFile.id,
                drive_web_link: driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
                mime_type: mimeType,
                size_bytes: bytes.length,
                offloaded_at: new Date().toISOString(),
              },
              { onConflict: "bucket_name,file_path" }
            );

            if (regErr) {
              throw new Error(`Registry upsert failed: ${regErr.message}`);
            }

            // 5. Purge from Supabase Storage
            const { error: rmErr } = await supabaseAdmin.storage.from(b.name).remove([filePath]);
            if (rmErr) {
              console.warn(`Removed from Drive but Supabase purge warning: ${rmErr.message}`);
            }

            totalFreedBytes += bytes.length;
            totalOffloadedCount += 1;
            results.push({ bucket: b.name, path: filePath, drive_id: driveFile.id, size: bytes.length });
          } catch (e: any) {
            console.error(`Failed to offload ${b.name}/${filePath}:`, e);
            results.push({ bucket: b.name, path: filePath, drive_id: "", size: 0, error: e.message || String(e) });
          }
        }
      }

      return json({
        success: true,
        offloaded_files_count: totalOffloadedCount,
        freed_bytes: totalFreedBytes,
        results,
      });
    }

    // -------------------------------------------------------------
    // 4. ACTION: RESTORE (Download Drive -> Upload Supabase -> Delete Registry)
    // -------------------------------------------------------------
    if (action === "restore") {
      const { bucket, path, id } = params;
      let registryRow: any = null;

      if (id) {
        const { data } = await supabaseAdmin.from("cold_storage_registry").select("*").eq("id", id).maybeSingle();
        registryRow = data;
      } else if (bucket && path) {
        const { data } = await supabaseAdmin
          .from("cold_storage_registry")
          .select("*")
          .eq("bucket_name", bucket)
          .eq("file_path", path)
          .maybeSingle();
        registryRow = data;
      }

      if (!registryRow || !registryRow.drive_file_id) {
        return json({ error: "Record not found in registry" }, 404);
      }

      // 1. Download file from Google Drive
      const driveRes = await downloadFile(registryRow.drive_file_id);
      if (!driveRes.ok) {
        return json({ error: `Drive download failed [${driveRes.status}]` }, driveRes.status);
      }

      const fileBuffer = await driveRes.arrayBuffer();

      // 2. Upload back to Supabase Storage
      const { error: upErr } = await supabaseAdmin.storage.from(registryRow.bucket_name).upload(
        registryRow.file_path,
        fileBuffer,
        {
          contentType: registryRow.mime_type || "application/octet-stream",
          upsert: true,
        }
      );

      if (upErr) {
        return json({ error: `Failed to restore to Supabase Storage: ${upErr.message}` }, 500);
      }

      // 3. Delete registry entry
      await supabaseAdmin.from("cold_storage_registry").delete().eq("id", registryRow.id);

      // Optional: Delete from drive
      try {
        await deleteDriveFile(registryRow.drive_file_id);
      } catch (e) {
        console.warn("Drive delete after restore failed (non-fatal):", e);
      }

      return json({
        success: true,
        restored: true,
        bucket: registryRow.bucket_name,
        path: registryRow.file_path,
      });
    }

    return json({ error: `Invalid action '${action}'` }, 400);
  } catch (err: any) {
    console.error("Storage Tier Function Error:", err);
    return json({ error: err.message || String(err) }, 500);
  }
});
