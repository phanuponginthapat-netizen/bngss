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

    // โหมดติดตั้งในโรงเรียน: ไม่ย้ายไฟล์ขึ้น Drive / ไม่บังคับโควต้า

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
        // นับไฟล์แบบ recursive (รวมโฟลเดอร์ย่อย) เพื่อให้ตัวเลขตรงกับที่ใช้จริง
        let bBytes = 0;
        let bFiles = 0;

        const countRecursive = async (prefix = "", depth = 0): Promise<void> => {
          if (depth > 5) return;
          let offset = 0;
          for (;;) {
            const { data = [] } = await supabaseAdmin.storage
              .from(b.name)
              .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
            if (!data || data.length === 0) break;
            for (const obj of data) {
              if (obj.id) {
                bFiles += 1;
                bBytes += obj.metadata?.size || 0;
              } else if (obj.name) {
                await countRecursive(prefix ? `${prefix}/${obj.name}` : obj.name, depth + 1);
              }
            }
            if (data.length < 1000) break;
            offset += 1000;
          }
        };
        await countRecursive();

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

      // แนบโควต้าที่ตั้งไว้ต่อบัคเก็ต เพื่อให้หน้าเว็บแสดงสัดส่วนการใช้งานได้
      const { data: quotaRows = [] } = await supabaseAdmin
        .from("storage_tier_policies")
        .select("bucket, quota_mb, enabled, dedupe_drive, older_than_days, keep_recent, priority");
      const quotaMap = new Map<string, any>((quotaRows || []).map((p: any) => [p.bucket, p]));
      const withQuota = bucketStats.map((b) => {
        const p = quotaMap.get(b.name);
        const quotaBytes = p?.quota_mb ? Number(p.quota_mb) * 1024 * 1024 : null;
        return {
          ...b,
          quota_bytes: quotaBytes,
          over_quota: quotaBytes != null && b.supabase_bytes > quotaBytes,
          policy_enabled: !!p?.enabled,
          dedupe_drive: !!p?.dedupe_drive,
        };
      });

      const quotaTotalBytes = (quotaRows || []).reduce(
        (s: number, p: any) => s + Number(p.quota_mb || 0) * 1024 * 1024,
        0,
      );

      return json({
        supabase_total_bytes: totalSupabaseBytes,
        supabase_total_files: totalSupabaseFiles,
        drive_total_bytes: offloadedBytes,
        drive_total_files: offloadedCount,
        free_tier_bytes: 1024 * 1024 * 1024,
        quota_total_bytes: quotaTotalBytes,
        target_under_1gb: totalSupabaseBytes < 1024 * 1024 * 1024,
        buckets: withQuota,
      });
    }

    // -------------------------------------------------------------
    // 2b. ACTION: DEDUPE (ลบสำเนาไฟล์ใน Supabase ที่มีต้นฉบับบน Drive แล้ว)
    // -------------------------------------------------------------
    if (action === "dedupe" || action === "enforce") {
      // (ทำงานต่อด้านล่างสำหรับ enforce — dedupe จะคืนผลทันที)
      const olderThanDays = Number(params.older_than_days ?? 3);
      const cutoffIso = new Date(Date.now() - olderThanDays * 86400000).toISOString();
      const limit = Number(params.max_files ?? 300);

      const { data: dupes = [] } = await supabaseAdmin
        .from("line_vault_items")
        .select("id, storage_path, thumbnail_path, size_bytes")
        .not("drive_file_id", "is", null)
        .not("storage_path", "is", null)
        .lt("created_at", cutoffIso)
        .order("created_at", { ascending: true })
        .limit(limit);

      let dedupedBytes = 0;
      let dedupedCount = 0;
      const chunk = 100;
      for (let i = 0; i < (dupes || []).length; i += chunk) {
        const slice = (dupes || []).slice(i, i + chunk);
        const paths = slice.map((r: any) => r.storage_path).filter(Boolean);
        if (paths.length === 0) continue;
        const { error: rmErr } = await supabaseAdmin.storage.from("line-vault").remove(paths);
        if (rmErr) {
          console.warn("line-vault dedupe remove warning:", rmErr.message);
          continue;
        }
        const ids = slice.map((r: any) => r.id);
        await supabaseAdmin.from("line_vault_items").update({ storage_path: null }).in("id", ids);
        dedupedCount += slice.length;
        dedupedBytes += slice.reduce((s: number, r: any) => s + Number(r.size_bytes || 0), 0);
      }

      if (action === "dedupe") {
        return json({ success: true, deduped_files: dedupedCount, freed_bytes: dedupedBytes });
      }
      params.__deduped = { count: dedupedCount, bytes: dedupedBytes };
    }

    // -------------------------------------------------------------
    // 2c. ACTION: ENFORCE (ย้ายไฟล์ส่วนที่เกินโควต้าของแต่ละบัคเก็ตลง Drive)
    // -------------------------------------------------------------
    if (action === "enforce") {
      const maxFiles = Number(params.max_files ?? 12);
      // ขีดจำกัดต่อรอบ กันฟังก์ชันใช้หน่วยความจำเกิน (ไฟล์ใหญ่มากจะทยอยทำรอบถัดไป)
      const maxFileBytes = Number(params.max_file_bytes ?? 24 * 1024 * 1024);
      const maxBytesPerRun = Number(params.max_bytes_per_run ?? 40 * 1024 * 1024);
      const onlyBuckets: string[] = Array.isArray(params.buckets) ? params.buckets : [];
      let query = supabaseAdmin
        .from("storage_tier_policies")
        .select("*")
        .eq("enabled", true)
        .not("quota_mb", "is", null);
      if (onlyBuckets.length > 0) query = query.in("bucket", onlyBuckets);
      const { data: policies = [] } = await query.order("priority", { ascending: true });

      let moved = 0;
      let freed = 0;
      const perBucket: Array<{ bucket: string; before: number; quota: number; moved: number; freed: number }> = [];

      for (const p of policies || []) {
        if (moved >= maxFiles) break;
        const bucket = p.bucket as string;
        const quotaBytes = Number(p.quota_mb) * 1024 * 1024;

        const listRecursive = async (prefix = "", depth = 0): Promise<any[]> => {
          if (depth > 4) return [];
          const out: any[] = [];
          const { data = [], error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 1000 });
          if (error) return out;
          for (const o of data || []) {
            if (o.id) out.push({ ...o, path: prefix ? `${prefix}/${o.name}` : o.name });
            else if (o.name) out.push(...(await listRecursive(prefix ? `${prefix}/${o.name}` : o.name, depth + 1)));
          }
          return out;
        };

        const objects = await listRecursive();
        let bucketBytes = objects.reduce((s, o) => s + Number(o.metadata?.size || 0), 0);
        const before = bucketBytes;
        let bucketMoved = 0;
        let bucketFreed = 0;

        if (bucketBytes > quotaBytes) {
          // ย้ายไฟล์เก่าสุดก่อน แต่คงไฟล์ล่าสุดตามที่นโยบายกำหนด
          const sorted = objects
            .filter((o) => o.path && !o.path.endsWith("/"))
            .sort((a, b2) => (a.created_at || "").localeCompare(b2.created_at || ""));
          const keepRecent = Number(p.keep_recent ?? 0);
          const candidates = keepRecent > 0 ? sorted.slice(0, Math.max(0, sorted.length - keepRecent)) : sorted;

          for (const obj of candidates) {
            if (bucketBytes <= quotaBytes || moved >= maxFiles || freed >= maxBytesPerRun) break;
            const objSize = Number(obj.metadata?.size || 0);
            if (objSize > maxFileBytes) continue; // ไฟล์ใหญ่มาก ทำในรอบถัดไปด้วยพารามิเตอร์เฉพาะ
            const mimeType = obj.metadata?.mimetype || "application/octet-stream";
            try {
              const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from(bucket).download(obj.path);
              if (dlErr || !fileData) throw new Error(dlErr?.message || "download failed");
              const bytes = new Uint8Array(await fileData.arrayBuffer());
              const folderId = await ensureFolderPath(["BNGSS Storage", bucket]);
              const driveFile = await uploadFile(obj.path.split("/").pop() || obj.path, mimeType, bytes, folderId);
              const { error: regErr } = await supabaseAdmin.from("cold_storage_registry").upsert(
                {
                  bucket_name: bucket,
                  file_path: obj.path,
                  drive_file_id: driveFile.id,
                  drive_web_link: driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
                  mime_type: mimeType,
                  size_bytes: bytes.length,
                  offloaded_at: new Date().toISOString(),
                },
                { onConflict: "bucket_name,file_path" },
              );
              if (regErr) throw new Error(regErr.message);
              await supabaseAdmin.storage.from(bucket).remove([obj.path]);
              bucketBytes -= bytes.length;
              bucketFreed += bytes.length;
              bucketMoved += 1;
              moved += 1;
              freed += bytes.length;
            } catch (e: any) {
              console.error(`enforce offload failed ${bucket}/${obj.path}:`, e?.message || e);
            }
          }
        }

        perBucket.push({ bucket, before, quota: quotaBytes, moved: bucketMoved, freed: bucketFreed });
      }

      return json({
        success: true,
        deduped: params.__deduped || { count: 0, bytes: 0 },
        moved_files: moved,
        freed_bytes: freed,
        buckets: perBucket,
      });
    }

    // -------------------------------------------------------------
    // 3. ACTION: OFFLOAD (Download Supabase -> Upload Drive -> Save Registry -> Remove Supabase)
    // -------------------------------------------------------------
    if (action === "offload") {
      const targetBuckets: string[] = params.buckets || [];
      const maxFiles: number = params.max_files || 50;

      // บัคเก็ตที่ห้ามย้ายเด็ดขาด — เป็นรูป/ไฟล์ที่หน้าเว็บต้องแสดงตลอดเวลา
      const NEVER_OFFLOAD = new Set([
        "cms-images",
        "cms-logos",
        "profile-images",
        "face-photos",
        "signatures",
        "line-richmenu",
        "game-covers",
        "certificate-assets",
        "print-templates",
        "pdf-templates",
      ]);

      // ย้ายได้เฉพาะบัคเก็ตที่มีนโยบายเปิดใช้งานเท่านั้น
      const { data: policies = [] } = await supabaseAdmin
        .from("storage_tier_policies")
        .select("*")
        .eq("enabled", true);
      const policyMap = new Map<string, any>((policies || []).map((p: any) => [p.bucket, p]));

      const { data: buckets = [] } = await supabaseAdmin.storage.listBuckets();
      const activeBuckets = (buckets || []).filter(
        (b) =>
          policyMap.has(b.name) &&
          !NEVER_OFFLOAD.has(b.name) &&
          (targetBuckets.length === 0 || targetBuckets.includes(b.name)),
      );

      let totalFreedBytes = 0;
      let totalOffloadedCount = 0;
      const results: Array<{ bucket: string; path: string; drive_id: string; size: number; error?: string }> = [];

      for (const b of activeBuckets) {
        if (totalOffloadedCount >= maxFiles) break;
        const policy = policyMap.get(b.name);
        const olderThanDays = Number(policy?.older_than_days ?? 90);
        const keepRecent = Number(policy?.keep_recent ?? 0);
        const cutoff = Date.now() - olderThanDays * 86400000;

        // ไล่ไฟล์แบบ recursive (รองรับไฟล์ที่อยู่ในโฟลเดอร์ย่อย)
        const listRecursive = async (prefix = "", depth = 0): Promise<any[]> => {
          if (depth > 4) return [];
          const out: any[] = [];
          const { data = [] } = await supabaseAdmin.storage.from(b.name).list(prefix, { limit: 1000 });
          for (const o of data || []) {
            if (o.id) out.push({ ...o, path: prefix ? `${prefix}/${o.name}` : o.name });
            else if (o.name) out.push(...(await listRecursive(prefix ? `${prefix}/${o.name}` : o.name, depth + 1)));
          }
          return out;
        };
        const rawObjects = await listRecursive();

        // เรียงใหม่→เก่า แล้วข้ามไฟล์ล่าสุดตามจำนวนที่ต้องเก็บไว้ และเก็บเฉพาะไฟล์ที่เก่ากว่ากำหนด
        const sorted = (rawObjects || [])
          .filter((o) => o.id && o.path && !o.path.endsWith("/"))
          .sort((a, b2) => (b2.created_at || "").localeCompare(a.created_at || ""));
        const objects = sorted
          .slice(keepRecent)
          .filter((o) => new Date(o.created_at || o.updated_at || 0).getTime() < cutoff);

        for (const obj of objects) {
          if (totalOffloadedCount >= maxFiles) break;
          if (!obj.path || obj.path.endsWith("/")) continue;

          const filePath = obj.path;
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
