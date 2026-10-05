// drive-archive — สำรอง/จัดเก็บข้อมูลย้อนหลังขึ้น Google Drive
// โครงโฟลเดอร์:  <ROOT>/ปีการศึกษา 2569/<ชื่องาน>/<table>_<ปี>_<timestamp>.json
// ใช้ Service Account หรือ OAuth refresh token ของโรงเรียน (เหมือน LINE Vault)
//
// POST { action: "policies" }                       → นโยบายการเก็บรักษา + สถานะสำรอง
// POST { action: "archive", year_be, modules?[] }   → สำรองข้อมูลปีนั้นขึ้น Drive
// POST { action: "list", year_be? }                 → รายการไฟล์ที่สำรองไว้
// POST { action: "restore", archive_id, mode }      → ดึงไฟล์กลับมา (preview | insert)
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeadersWithCron } from "../_shared/cors.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { ensureFolderPath, uploadFile, downloadFile } from "../_shared/googleDrive.ts";

const corsHeaders = corsHeadersWithCron;
const ROOT_FOLDER = Deno.env.get("DRIVE_ARCHIVE_ROOT") || "BNGSS Archive";
const PAGE = 1000;
const MAX_ROWS = 100000;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** คอลัมน์ที่ใช้ตัดสินปีการศึกษาของแต่ละตาราง (เรียงตามลำดับความสำคัญ) */
const YEAR_COLUMNS = ["academic_year", "academic_year_be", "fiscal_year"];
const DATE_COLUMNS = ["record_date", "clock_date", "attendance_date", "created_at"];

type Policy = {
  code: string;
  label: string;
  tables: string[];
  retention_years: number | null;
};

/** ดึงข้อมูลของตารางเฉพาะปีการศึกษาที่ต้องการ (CE year) แบบแบ่งหน้า */
async function fetchYearRows(admin: any, table: string, ceYear: number): Promise<any[]> {
  const attempts: Array<() => any> = [
    ...YEAR_COLUMNS.map((col) => () => admin.from(table).select("*").eq(col, ceYear)),
    ...DATE_COLUMNS.map((col) => () =>
      admin.from(table).select("*").gte(col, `${ceYear}-01-01`).lt(col, `${ceYear + 1}-01-01`)
    ),
  ];

  for (const build of attempts) {
    const rows: any[] = [];
    let failed = false;
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await build().range(from, from + PAGE - 1);
      if (error) {
        // คอลัมน์ไม่มีในตารางนี้ → ลองเงื่อนไขถัดไป
        failed = true;
        break;
      }
      rows.push(...(data || []));
      if ((data || []).length < PAGE) break;
    }
    if (!failed) return rows;
  }
  throw new Error(`ไม่พบคอลัมน์ปี/วันที่ที่ใช้แบ่งข้อมูลในตาราง ${table}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;

  try {
    const admin = makeAdmin();
    const body = await req.json().catch(() => ({}));
    const action = body?.action || "policies";

    // ── นโยบาย + สถานะสำรอง ────────────────────────────────
    if (action === "policies") {
      const [{ data: policies }, { data: archives }] = await Promise.all([
        admin.from("data_retention_policies").select("*").order("sort_order"),
        admin.from("drive_archives").select("academic_year_be, module_code, row_count, byte_size, created_at"),
      ]);
      return json({ policies: policies || [], archives: archives || [], root_folder: ROOT_FOLDER });
    }

    // ── รายการไฟล์สำรอง ───────────────────────────────────
    if (action === "list") {
      let q = admin.from("drive_archives").select("*").order("academic_year_be", { ascending: false }).order("created_at", { ascending: false });
      if (body.year_be) q = q.eq("academic_year_be", Number(body.year_be));
      const { data, error } = await q.limit(500);
      if (error) throw new Error(error.message);
      return json({ archives: data || [] });
    }

    // ── ดึงไฟล์กลับมาใช้งาน ───────────────────────────────
    if (action === "restore") {
      const { data: rec, error } = await admin.from("drive_archives").select("*").eq("id", body.archive_id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!rec) return json({ error: "ไม่พบรายการสำรองนี้" }, 404);

      const res = await downloadFile(rec.file_id);
      if (!res.ok) return json({ error: `ดาวน์โหลดจาก Drive ไม่สำเร็จ [${res.status}]: ${await res.text()}` }, res.status);
      const rows = JSON.parse(await res.text());

      if (body.mode === "insert") {
        // นำกลับเข้าฐานข้อมูลแบบไม่ทับของเดิม (upsert ตาม primary key id)
        let inserted = 0;
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          const { error: upErr } = await admin.from(rec.table_name).upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
          if (upErr) throw new Error(`นำเข้ากลับไม่สำเร็จ (${rec.table_name}): ${upErr.message}`);
          inserted += chunk.length;
        }
        return json({ success: true, table: rec.table_name, restored: inserted });
      }

      return json({ success: true, table: rec.table_name, row_count: rows.length, preview: rows.slice(0, 20) });
    }

    // ── สำรองข้อมูลขึ้น Drive ──────────────────────────────
    if (action === "archive") {
      const yearBE = Number(body.year_be);
      if (!yearBE || yearBE < 2500) return json({ error: "ต้องระบุปีการศึกษา (พ.ศ.)" }, 400);
      const ceYear = yearBE - 543;

      const { data: allPolicies } = await admin.from("data_retention_policies").select("*").order("sort_order");
      const wanted: string[] | undefined = Array.isArray(body.modules) && body.modules.length ? body.modules : undefined;
      const policies: Policy[] = (allPolicies || []).filter((p: Policy) => !wanted || wanted.includes(p.code));
      if (!policies.length) return json({ error: "ไม่พบงานที่ต้องการสำรอง" }, 400);

      const results: any[] = [];
      let totalRows = 0;
      let totalBytes = 0;

      for (const p of policies) {
        const folderId = await ensureFolderPath([ROOT_FOLDER, `ปีการศึกษา ${yearBE}`, p.label]);

        for (const table of p.tables) {
          try {
            const rows = await fetchYearRows(admin, table, ceYear);
            if (!rows.length) {
              results.push({ module: p.code, table, rows: 0, skipped: "ไม่มีข้อมูลในปีนี้" });
              continue;
            }

            const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const fileName = `${table}_${yearBE}_${stamp}.json`;
            const bytes = new TextEncoder().encode(JSON.stringify(rows, null, 0));
            const uploaded = await uploadFile(fileName, "application/json", bytes, folderId);

            await admin.from("drive_archives").insert({
              academic_year_be: yearBE,
              module_code: p.code,
              module_label: p.label,
              table_name: table,
              file_id: uploaded.id,
              file_name: fileName,
              web_link: uploaded.webViewLink || null,
              folder_path: `${ROOT_FOLDER}/ปีการศึกษา ${yearBE}/${p.label}`,
              row_count: rows.length,
              byte_size: bytes.length,
              format: "json",
            });

            totalRows += rows.length;
            totalBytes += bytes.length;
            results.push({ module: p.code, table, rows: rows.length, bytes: bytes.length, link: uploaded.webViewLink });
          } catch (e) {
            results.push({ module: p.code, table, error: String((e as Error)?.message || e) });
          }
        }
      }

      return json({ success: true, year_be: yearBE, total_rows: totalRows, total_bytes: totalBytes, results });
    }

    return json({ error: `ไม่รู้จัก action: ${action}` }, 400);
  } catch (e) {
    console.error("[drive-archive]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
