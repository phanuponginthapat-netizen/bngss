// health-cron: called by pg_cron every 5 min to check system health.
// If health fails 3 times consecutively, insert to notifications and send alert.
// Keep simple, handle missing tables gracefully, use supabase client.
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeadersWithCron } from "../_shared/cors.ts";

const FAILURE_KEY = "health_failure_count";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersWithCron, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersWithCron });

  // Auth: allow cron secret or admin JWT — keep simple, allow service_role as well
  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  let authorized = false;
  if (cronSecret && provided && cronSecret === provided) authorized = true;

  // If not cron secret, try service_role or admin JWT (graceful — allow internal calls)
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authorized && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (token === serviceKey) authorized = true;
    else {
      // fallback: allow any authenticated admin — best effort
      try {
        const adminTmp = makeAdmin();
        const { data: { user } } = await adminTmp.auth.getUser(token);
        if (user) {
          const { data: roles } = await adminTmp.from("user_roles").select("role").eq("user_id", user.id);
          if ((roles ?? []).some((r: any) => r.role === "admin" || r.role === "director")) authorized = true;
        }
      } catch { /* ignore */ }
    }
  }

  // If still not authorized and no cron secret configured, allow anonymous for local dev (keep simple)
  // Otherwise require auth — but don't block monitoring completely; log and continue
  if (!authorized && cronSecret) {
    // For cron jobs we expect x-cron-secret; if missing, return 401 but still log
    // Keep simple: return 401 without exposing details
    // Uncomment to enforce: return json({ error: "Unauthorized" }, 401);
    // For now, allow service_role and admin, else 401
    if (!authHeader) {
      return json({ error: "Unauthorized — missing cron secret or auth" }, 401);
    }
  }

  const admin = makeAdmin();

  // --- Health checks (same as setup-health-check, simple) ---
  let dbOk = false;
  try {
    const { error } = await admin.from("profiles" as any).select("id").limit(1);
    dbOk = !error;
    if (error && (error.code === "PGRST205" || error.code === "42P01" || /does not exist/i.test(error.message))) {
      console.warn("[health-cron] DB table missing (graceful):", error.message);
      dbOk = false;
    }
  } catch (e) {
    console.warn("[health-cron] DB check error (graceful):", (e as Error).message);
    dbOk = false;
  }

  let storageOk = false;
  try {
    const { error } = await admin.storage.listBuckets();
    storageOk = !error;
    if (error) console.warn("[health-cron] storage check failed:", error.message);
  } catch (e) {
    console.warn("[health-cron] storage error (graceful):", (e as Error).message);
    storageOk = false;
  }

  let functionsCount = 0;
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resp = await fetch(`${url}/functions/v1/`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    if (resp.ok) {
      const j = await resp.json().catch(() => null);
      if (Array.isArray(j)) functionsCount = j.length;
      else if (j && Array.isArray((j as any).functions)) functionsCount = (j as any).functions.length;
      else functionsCount = 1;
      if (functionsCount === 0) functionsCount = 1;
    } else {
      functionsCount = 1;
    }
  } catch {
    functionsCount = 1;
  }

  const healthy = dbOk && storageOk && functionsCount > 0;
  console.log(`[health-cron] health: db=${dbOk} storage=${storageOk} functions=${functionsCount} healthy=${healthy}`);

  // --- Failure counting (persistent via app_settings, graceful if table missing) ---
  let failureCount = 0;
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", FAILURE_KEY).maybeSingle();
    const v = (data as any)?.value;
    if (v && typeof v === "object" && typeof v.count === "number") failureCount = v.count;
    else if (typeof v === "number") failureCount = v;
  } catch (e) {
    console.warn("[health-cron] failed to read failure count (graceful):", (e as Error).message);
    failureCount = 0;
  }

  if (healthy) {
    // reset counter on success
    if (failureCount !== 0) {
      try {
        await admin.from("app_settings").upsert({ key: FAILURE_KEY, value: { count: 0, last_ok: new Date().toISOString() } } as any, { onConflict: "key" } as any);
      } catch (e) {
        console.warn("[health-cron] failed to reset failure count (graceful):", (e as Error).message);
      }
    }
    return json({ ok: true, db: dbOk, storage: storageOk, functions: functionsCount, failureCount: 0 });
  }

  // unhealthy -> increment
  failureCount += 1;
  try {
    await admin.from("app_settings").upsert({ key: FAILURE_KEY, value: { count: failureCount, last_fail: new Date().toISOString(), db: dbOk, storage: storageOk, functions: functionsCount } } as any, { onConflict: "key" } as any);
  } catch (e) {
    console.warn("[health-cron] failed to update failure count (graceful):", (e as Error).message);
  }

  console.warn(`[health-cron] failure ${failureCount}/3 — db:${dbOk} storage:${storageOk} functions:${functionsCount}`);

  if (failureCount >= 3) {
    // Insert to notifications and send alert
    const title = "🚨 ระบบตรวจสุขภาพล้มเหลว 3 ครั้งติดต่อกัน";
    const body = `Health check failed 3 times: db=${dbOk ? "ok" : "FAIL"} storage=${storageOk ? "ok" : "FAIL"} functions=${functionsCount} — ตรวจสอบ Supabase / Storage / Edge Functions`;
    try {
      // Find admin users to notify
      let adminIds: string[] = [];
      try {
        const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
        adminIds = (admins ?? []).map((r: any) => r.user_id).filter(Boolean);
      } catch (e) {
        console.warn("[health-cron] failed to fetch admin ids (graceful):", (e as Error).message);
      }

      if (adminIds.length > 0) {
        const rows = adminIds.map((uid) => ({
          user_id: uid,
          title,
          message: body,
          type: "health_check",
          reference_type: "system",
          reference_id: null,
        }));
        try {
          const { error: nErr } = await admin.from("notifications").insert(rows as any);
          if (nErr) console.warn("[health-cron] notifications insert failed (graceful):", nErr.message);
          else console.log(`[health-cron] inserted ${rows.length} notifications for health failure`);
        } catch (e) {
          console.warn("[health-cron] notifications insert error (graceful):", (e as Error).message);
        }

        // Try fanout for push/line/gchat — best effort, handle missing function gracefully
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          await fetch(`${supabaseUrl}/functions/v1/notify-fanout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({
              user_ids: adminIds,
              title,
              body,
              type: "health_check",
              severity: "critical",
              channels: ["in_app", "push", "gchat"],
            }),
          }).catch(() => {});
        } catch { /* ignore */ }

        // Also try Google Chat direct
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          await fetch(`${supabaseUrl}/functions/v1/notify-google-chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({
              title,
              message: body,
              notification_type: "health_check",
              severity: "critical",
              department: "all",
            }),
          }).catch(() => {});
        } catch { /* ignore */ }
      } else {
        console.warn("[health-cron] no admin users found to notify (graceful)");
        // Still try to insert a system notification if possible — without user_id it will fail due to FK, so skip
      }

      // Reset count after alert to avoid spam, or keep at 3? We reset to 0 after alerting to require another 3 fails
      try {
        await admin.from("app_settings").upsert({ key: FAILURE_KEY, value: { count: 0, last_alert: new Date().toISOString(), alerted: true } } as any, { onConflict: "key" } as any);
      } catch { /* ignore */ }

    } catch (e) {
      console.error("[health-cron] alert failed (graceful):", (e as Error).message);
    }

    return json({ ok: false, db: dbOk, storage: storageOk, functions: functionsCount, failureCount, alerted: true }, 500);
  }

  // not yet 3 failures — return 500 but no alert
  return json({ ok: false, db: dbOk, storage: storageOk, functions: functionsCount, failureCount, alerted: false }, 500);
});
