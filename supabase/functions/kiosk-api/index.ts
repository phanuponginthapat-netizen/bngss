// ConnextedScan kiosk agent API — จุดเชื่อมระหว่างโปรแกรมสแกนหน้าในเครื่องกับระบบ BNGSS
// เส้นทางย่อย (ต่อท้าย /kiosk-api): /sync /attendance /embeddings /alert /visitor
//                                   /door-command /power-command /live /ping
//                                   /content /recent /today-stats (หน้าจอสแกนดึง CMS/หลังบ้าน)
// รับรองเครื่องด้วย header: x-device-key  (ดูรหัสเครื่องได้ที่หน้า "ตั้งค่าคีออส")
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { evaluateSchoolScan, bangkokScanMinutes } from "../_shared/schoolScanPolicy.ts";
import { kioskMediaUrl } from "../_shared/kioskMedia.ts";
import { facegateSaver } from "../_shared/facegatePolicy.ts";

const cors = { ...corsHeaders, "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"] ?? "authorization, x-client-info, apikey, content-type"}, x-device-key` };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const bkkDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);

// ── ค่าตั้งค่าเริ่มต้นของตู้สแกน (ปรับได้ที่ school_settings → kiosk_config) ──
const DEFAULT_SETTINGS = {
  match_threshold: 0.45,
  detector_min_score: 0.5,
  min_face_coverage: 0.0,
  next_person_delay_seconds: 2,
  duplicate_cooldown_minutes: 300,
  require_liveness: true,
  geometry_weight: 0.3,
  geometry_min_score: 0.45,
  checkin_only_mode: true,
  auto_update_enabled: false,
  visitor_mode: false,
  late_after: "08:30",
  voice_welcome_text: "ยินดีต้อนรับ",
  voice_denied_text: "ท่านไม่ใช่บุคลากรหรือนักเรียนของเรา กรุณาติดต่อเจ้าหน้าที่",
  voice_duplicate_text: "บันทึกเวลาไปแล้ว",
  door_enabled: false,
  door_open_seconds: 5,
  door_angle_down: 10,
  door_angle_up: 100,
  door_move_step: 3,
  door_move_delay_ms: 12,
  door_hold_power: true,
  door_buzzer_enabled: false,
  door_use_relay: false,
  door_invert_servo: false,
  door_deny_alarm: true,
};

type Device = { id: string; device_id: string; name: string; default_direction: string };

async function authDevice(req: Request, db: ReturnType<typeof admin>): Promise<Device | null> {
  const key = req.headers.get("x-device-key")?.trim();
  if (!key) return null;
  const { data } = await db
    .from("kiosk_devices")
    .select("id, device_id, name, default_direction, is_active")
    .eq("device_key", key)
    .maybeSingle();
  if (!data || (data as any).is_active === false) return null;
  return {
    id: (data as any).id,
    device_id: (data as any).device_id,
    name: (data as any).name || (data as any).device_id,
    default_direction: (data as any).default_direction || "in",
  };
}

async function loadSettings(db: ReturnType<typeof admin>) {
  const { data, error } = await db
    .from("school_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["kiosk_config", "face_scan_mode_cutoff", "face_scan_entry_window", "face_scan_exit_window", "face_liveness_enabled", "clock_late_threshold"]);
  if (error) throw error;
  const school = Object.fromEntries((data ?? []).map(row => [row.setting_key, row.setting_value]));
  let v: any = school.kiosk_config ?? {};
  if (typeof v === "string") v = JSON.parse(v);
  return { ...DEFAULT_SETTINGS, ...(v && typeof v === "object" ? v : {}),
    face_scan_mode_cutoff: school.face_scan_mode_cutoff ?? "12:00",
    face_scan_entry_window: school.face_scan_entry_window ?? "",
    face_scan_exit_window: school.face_scan_exit_window ?? "",
    ...(school.face_liveness_enabled != null ? { require_liveness: school.face_liveness_enabled !== "false" } : {}),
    late_after: school.clock_late_threshold ?? DEFAULT_SETTINGS.late_after,
  };
}

/** เก็บภาพใบหน้าที่สแกนได้ลง storage แล้วคืน signed URL (ล้มเหลว = ไม่มีรูป) */
async function storeSnapshot(db: ReturnType<typeof admin>, snapshot: string | null, personId: string) {
  if (!snapshot) return null;
  try {
    const raw = snapshot.includes(",") ? snapshot.slice(snapshot.indexOf(",") + 1) : snapshot;
    const bin = atob(raw);
    if (bin.length > 5_000_000) return null;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const path = `scans/${bkkDate()}/${personId}-${Date.now()}.jpg`;
    const { error } = await db.storage.from("face-photos").upload(path, bytes, { contentType: "image/jpeg" });
    if (error) return null;
    const { data } = await db.storage.from("face-photos").createSignedUrl(path, 60 * 60 * 24 * 7);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/kiosk-api\/?/, "").replace(/\/+$/, "") || "ping";
  const db = admin();

  try {
    if (route === "ping") return json({ ok: true, service: "kiosk-api", server_time: new Date().toISOString() });

    const device = await authDevice(req, db);
    if (!device) return json({ error: "invalid device key" }, 401);

    const body = await req.json().catch(() => ({} as any));
    const settings = await loadSettings(db);

    // ── หน้าจอสแกน (PC FaceGate + แท็บเล็ต): แบรนด์/ข้อความจาก CMS และหลังบ้าน ──
    if (route === "content") {
      const keys = ["app_name", "school_name", "school_short_name", "school_logo", "school_logo_512",
        "theme_primary_color", "theme_accent_color", "primary_color", "theme_color"];
      const [{ data: cms }, { data: school }] = await Promise.all([
        db.from("cms_settings").select("key, value").in("key", keys),
        db.from("schools").select("school_name, short_name, logo_url").eq("is_active", true).limit(1).maybeSingle(),
      ]);
      const m: Record<string, string> = {};
      ((cms as any[]) ?? []).forEach((r) => { if (r?.value) m[r.key] = String(r.value); });
      const sc: any = school ?? {};
      const kioskText = Object.fromEntries(
        Object.entries(settings).filter(([k, v]) => /^(kiosk_|news_|theme_)/.test(k) && (typeof v === "string" || typeof v === "boolean")),
      );
      return json({
        ...kioskText,
        school_name: m.school_name || sc.school_name || "",
        brand_name: m.app_name || m.school_short_name || sc.short_name || "",
        logo_url: m.school_logo_512 || m.school_logo || sc.logo_url || "",
        theme_primary: (settings as any).theme_primary || m.theme_primary_color || m.primary_color || m.theme_color || undefined,
        theme_accent: (settings as any).theme_accent || m.theme_accent_color || undefined,
        admin_url: "https://bngss.online/dashboard/admin/facegate",
        server_time: new Date().toISOString(),
      });
    }

    if (route === "recent" || route === "today-stats") {
      const today = bkkDate();
      if (route === "today-stats") {
        const startUtc = new Date(`${today}T00:00:00+07:00`).toISOString();
        const [studentResult, staffResult, totalStudents, totalStaff] = await Promise.all([
          db.from("face_scan_logs").select("student_id", { count: "exact", head: true })
            .eq("scan_date", today).eq("scan_type", "entry"),
          db.from("kiosk_agent_alerts").select("id", { count: "exact", head: true })
            .eq("kind", "staff_pass").gte("created_at", startUtc),
          db.from("students").select("id",{count:"exact",head:true}).eq("status","active"),
          db.from("personnel").select("id",{count:"exact",head:true}).eq("status","active"),
        ]);
        for(const result of [studentResult,staffResult,totalStudents,totalStaff]) if(result.error) throw result.error;
        return json({ ...facegateSaver(settings), students_present: studentResult.count, staff_present: staffResult.count,
          total_students:totalStudents.count,total_staff:totalStaff.count,absent_students:null,absent_staff:null,
          server_time: new Date().toISOString(), visitor_register_enabled: false });
      }
      const { data: logs, error: logsError } = await db.from("face_scan_logs")
        .select("student_id, scan_time, scan_type, captured_face_url, students(prefix, first_name, last_name, photo_url, classrooms!students_classroom_id_fkey(name))")
        .eq("scan_date", today).order("scan_time", { ascending: false }).limit(12);
      if (logsError) throw logsError;
      const ids = [...new Set((logs ?? []).map((l: any) => l.student_id).filter(Boolean))];
      const { data: faces, error: faceError } = ids.length
        ? await db.from("student_face_descriptors").select("student_id, face_image").in("student_id", ids).order("created_at", { ascending: false })
        : { data: [], error: null };
      if (faceError) throw faceError;
      const avatars = new Map<string, string>();
      for (const face of faces ?? []) {
        if (!avatars.has(face.student_id)) {
          const image = await kioskMediaUrl(db, face.face_image);
          if (image) avatars.set(face.student_id, image);
        }
      }
      const items = await Promise.all(((logs as any[]) ?? []).map(async (l) => ({
        name: `${l.students?.prefix ?? ""}${l.students?.first_name ?? ""} ${l.students?.last_name ?? ""}`.trim() || "นักเรียน",
        detail: l.students?.classrooms?.name ?? "",
        scanned_at: l.scan_time,
        direction: l.scan_type === "exit" ? "out" : "in",
        snapshot_url: await kioskMediaUrl(db, l.captured_face_url),
        avatar_url: await kioskMediaUrl(db, l.students?.photo_url) || avatars.get(l.student_id) || null,
      })));
      const media:any[]=[];
      for(let from=0;;from+=500){
        const {data,error}=await db.from("facegate_broadcast_media").select("id,title,storage_path,media_type,duration_seconds").eq("is_active",true).order("sort_order").order("id").range(from,from+499);
        if(error)throw error;
        media.push(...(data??[])); if((data??[]).length<500)break;
      }
      const broadcast_media=await Promise.all(media.map(async item=>{const {data,error}=await db.storage.from("face-photos").createSignedUrl(item.storage_path,3600);if(error)throw error;return {...item,url:data.signedUrl};}));
      return json({
        broadcast_media,
        display: {
          voice_enabled: (settings as any).voice_enabled !== false,
          voice_volume: (settings as any).voice_volume ?? 1,
          voice_rate: (settings as any).voice_rate ?? 1,
          mirror: (settings as any).kiosk_mirror !== false,
          rotate: (settings as any).kiosk_camera_rotate ?? 0,
          live_view: (settings as any).live_view_enabled !== false,
          show_recent: (settings as any).kiosk_show_recent !== false,
          news_enabled: Boolean((settings as any).news_text ?? (settings as any).kiosk_news),
          news_text: String((settings as any).news_text ?? (settings as any).kiosk_news ?? ""),
        },
        items,
      });
    }

    // ── ดึงข้อมูลลงเครื่อง (รายชื่อ + ใบหน้า + ค่าตั้งค่า) ────────────────
    if (route === "sync") {
      const known: Record<string, string> = (body?.known && typeof body.known === "object") ? body.known : {};
      const incremental = Object.keys(known).length > 0;

      await db.from("kiosk_devices").update({
        last_seen_at: new Date().toISOString(),
        status: "online",
        ...(typeof body?.agent_version === "string" ? { agent_version: body.agent_version.slice(0, 40) } : {}),
        ...(typeof body?.platform === "string" ? { platform: body.platform.slice(0, 80) } : {}),
        ...(typeof body?.disk_free_mb === "number" ? { disk_free_mb: Math.max(0, Math.round(body.disk_free_mb)) } : {}),
        ...(typeof body?.camera_ok === "boolean" ? { camera_ok: body.camera_ok } : {}),
        ...(typeof body?.door_ok === "boolean" ? { door_ok: body.door_ok } : {}),
        ...(typeof body?.health_note === "string" ? { health_note: body.health_note.slice(0, 300) } : {}),
      }).eq("id", device.id);

      const [{ data: students }, { data: personnel }, { data: sFaces }, { data: pFaces }] = await Promise.all([
        db.from("students")
          .select("id, student_code, prefix, first_name, last_name, status, photo_url, classrooms!students_classroom_id_fkey(name, grade_level)")
          .eq("status", "active").limit(20000),
        db.from("personnel").select("id, employee_code, prefix, first_name, last_name, status").limit(5000),
        db.from("student_face_descriptors").select("id, student_id, descriptor, metrics, created_at, face_image").limit(40000),
        db.from("personnel_face_descriptors").select("id, personnel_id, descriptor, metrics, created_at").limit(10000),
      ]);

      const people = [
        ...await Promise.all(((students as any[]) ?? []).map(async (s) => ({
          id: s.id,
          student_code: s.student_code ?? "",
          full_name: `${s.prefix ?? ""}${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
          nickname: null,
          class_room: s.classrooms?.name || s.classrooms?.grade_level || "-",
          person_type: "student",
          is_active: true,
          avatar_url: await kioskMediaUrl(db, s.photo_url) || await kioskMediaUrl(db, (sFaces ?? []).find((f: any) => f.student_id === s.id && /^data:image\//.test(f.face_image || ""))?.face_image),
        }))),
        ...((personnel as any[]) ?? []).filter((p) => (p.status ?? "active") === "active").map((p) => ({
          id: p.id,
          student_code: p.employee_code ?? "",
          full_name: `${p.prefix ?? ""}${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
          nickname: null,
          class_room: "บุคลากร",
          person_type: "staff",
          is_active: true,
        })),
      ];

      const rows = [
        ...((sFaces as any[]) ?? []).map((f) => ({ id: f.id, owner: f.student_id, ...f })),
        ...((pFaces as any[]) ?? []).map((f) => ({ id: f.id, owner: f.personnel_id, ...f })),
      ].filter((f) => Array.isArray(f.descriptor) && f.descriptor.length >= 64);

      const version = (f: any) => String(f.created_at ?? "");
      const embeddings = rows
        .filter((f) => !incremental || known[f.id] !== version(f))
        .map((f) => ({
          id: f.id,
          student_id: f.owner,
          embedding: f.descriptor,
          geometry: (f.metrics && typeof f.metrics === "object" ? f.metrics.geometry ?? null : null),
          version: version(f),
        }));
      const liveIds = new Set(rows.map((f) => f.id));
      const removed = incremental ? Object.keys(known).filter((id) => !liveIds.has(id)) : [];

      return json({
        device: { id: device.device_id, name: device.name, default_direction: device.default_direction },
        settings,
        students: people,
        embeddings,
        removed,
        incremental,
        total_embeddings: rows.length,
        pending: [],
        server_time: new Date().toISOString(),
      });
    }

    // ── บันทึกผลสแกน ─────────────────────────────────────────────────────
    if (route === "attendance") {
      const personId = String(body?.student_id ?? "");
      const confidence = Number(body?.confidence ?? 0);
      const isQr = body?.method === "qr";
      if (!/^[0-9a-f-]{36}$/i.test(personId)) return json({ error: "invalid body" }, 400);

      const requested = body?.direction === "out" ? "out" : body?.direction === "in" ? "in" : device.default_direction === "out" ? "out" : device.default_direction === "in" ? "in" : undefined;
      const scanPolicy = evaluateSchoolScan(settings, bangkokScanMinutes(new Date()), requested);
      const direction = scanPolicy.direction;
      if (!scanPolicy.allowed) return json({ result: "denied", message: scanPolicy.reason, speak: scanPolicy.reason, next_delay_seconds: 1 });
      const geometryScore = typeof body?.geometry_score === "number" ? body.geometry_score : null;
      const delay = Number(settings.next_person_delay_seconds) || 5;

      const geometryMin = Number(settings.geometry_min_score) || 0;
      if (!isQr && geometryScore !== null && geometryMin > 0 && geometryScore < geometryMin) {
        return json({
          result: "denied",
          message: "สัดส่วนใบหน้าไม่ตรงกับข้อมูลที่ลงทะเบียนไว้ กรุณาสแกนอีกครั้ง",
          speak: "กรุณาสแกนอีกครั้ง",
          next_delay_seconds: delay,
        });
      }

      const { data: student, error: studentError } = await db
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, status")
        .eq("id", personId).maybeSingle();
      if (studentError) throw studentError;

      let name = "";
      let isStaff = false;
      if (student) {
        if (((student as any).status ?? "active") !== "active") {
          return json({ result: "denied", message: "บัญชีนี้ถูกระงับการใช้งาน", speak: settings.voice_denied_text, next_delay_seconds: delay });
        }
        name = `${(student as any).prefix ?? ""}${(student as any).first_name ?? ""} ${(student as any).last_name ?? ""}`.trim();
      } else {
        const { data: staff, error: staffError } = await db
          .from("personnel").select("id, prefix, first_name, last_name, status").eq("id", personId).maybeSingle();
        if (staffError) throw staffError;
        if (staff && staff.status !== "active") return json({ result: "denied", message: "บัญชีนี้ไม่ได้ปฏิบัติงานแล้ว", next_delay_seconds: delay });
        if (!staff) {
          return json({ result: "denied", message: "ไม่พบข้อมูลในระบบ", speak: settings.voice_denied_text, next_delay_seconds: delay });
        }
        isStaff = true;
        name = `${(staff as any).prefix ?? ""}${(staff as any).first_name ?? ""} ${(staff as any).last_name ?? ""}`.trim();
      }

      // กันสแกนซ้ำ (ช่วงเวลาตั้งค่าได้)
      const cooldownMin = Number(settings.duplicate_cooldown_minutes) || 0;
      if (!isStaff && cooldownMin > 0) {
        const since = new Date(Date.now() - cooldownMin * 60_000).toISOString();
        const { data: recent, error: recentError } = await db
          .from("face_scan_logs")
          .select("id, scan_time")
          .eq("student_id", personId)
          .eq("scan_type", direction === "out" ? "exit" : "entry")
          .gte("scan_time", since)
          .limit(1);
        if (recentError) throw recentError;
        if ((recent as any[])?.length) {
          return json({
            result: "duplicate",
            student_id: personId,
            name,
            message: `${name} บันทึกเวลาไปแล้ววันนี้`,
            speak: settings.voice_duplicate_text,
            next_delay_seconds: delay,
          });
        }
      }

      const snapshotUrl = await storeSnapshot(db, typeof body?.snapshot === "string" ? body.snapshot : null, personId);

      if (isStaff) {
        // บุคลากรยังไม่มีตารางลงเวลาเฉพาะ — บันทึกเป็นประวัติการผ่านประตูไว้ก่อน
        const { error } = await db.from("kiosk_agent_alerts").insert({
          device_id: device.device_id, device_name: device.name,
          kind: "staff_pass", snapshot_url: snapshotUrl, note: name,
        });
        if (error) throw error;
      } else {
        const now = new Date();
        const { error } = await db.from("face_scan_logs").insert({
          student_id: personId,
          scan_date: bkkDate(now),
          scan_time: now.toISOString(),
          scan_type: direction === "out" ? "exit" : "entry",
          confidence: isQr ? null : Number.isFinite(confidence) ? confidence : null,
          device_label: device.name,
          entry_method: isQr ? "qr" : "face",
          geometry_score: isQr ? null : geometryScore,
          match_engine: isQr ? "student-card-qr" : "connexted-arcface",
          captured_face_url: snapshotUrl,
        });
        if (error) {
          // ซ้ำกับรายการของวันนี้ (unique ต่อวัน) — ถือว่าบันทึกไปแล้ว ไม่ใช่ข้อผิดพลาด
          if ((error as any).code === "23505") {
            return json({
              result: "duplicate", student_id: personId, name,
              message: `${name} บันทึกเวลาไปแล้ววันนี้`,
              speak: settings.voice_duplicate_text,
              next_delay_seconds: delay,
            });
          }
          return json({ error: "insert_failed", details: error.message }, 500);
        }
      }

      return json({
        result: "ok",
        student_id: personId,
        name,
        direction,
        confidence,
        message: direction === "out" ? `${name} บันทึกเวลาออกแล้ว` : `${name} บันทึกเวลาเข้าเรียบร้อย`,
        speak: direction === "out" ? `เดินทางปลอดภัย ${name}` : `${settings.voice_welcome_text} ${name}`,
        next_delay_seconds: delay,
      });
    }

    // ── ส่งค่าใบหน้าที่คำนวณในเครื่องกลับมาเก็บ ───────────────────────────
    if (route === "embeddings") {
      const items = Array.isArray(body?.items) ? body.items : [];
      let saved = 0;
      for (const it of items) {
        const id = String(it?.id ?? "");
        const emb = it?.embedding;
        if (!/^[0-9a-f-]{36}$/i.test(id) || !Array.isArray(emb) || emb.length < 64) continue;
        const patch: any = { descriptor: emb, model_version: "w600k_mbf" };
        if (it?.geometry && typeof it.geometry === "object") patch.metrics = { geometry: it.geometry };
        const { error } = await db.from("student_face_descriptors").update(patch).eq("id", id);
        if (!error) saved += 1;
      }
      return json({ ok: true, saved });
    }

    // ── คนแปลกหน้า ───────────────────────────────────────────────────────
    if (route === "alert") {
      const snapshotUrl = await storeSnapshot(db, typeof body?.snapshot === "string" ? body.snapshot : null, "unknown");
      const { count } = await db
        .from("kiosk_agent_alerts")
        .select("id", { count: "exact", head: true })
        .eq("device_id", device.device_id)
        .eq("kind", "unknown_face")
        .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
      await db.from("kiosk_agent_alerts").insert({
        device_id: device.device_id, device_name: device.name,
        kind: "unknown_face", snapshot_url: snapshotUrl,
        note: typeof body?.note === "string" ? body.note.slice(0, 300) : null,
      });
      return json({ ok: true, escalated: (count ?? 0) >= 3 });
    }

    // ── ผู้มาติดต่อ ──────────────────────────────────────────────────────
    if (route === "visitor") {
      const snapshotUrl = await storeSnapshot(db, typeof body?.snapshot === "string" ? body.snapshot : null, "visitor");
      await db.from("kiosk_visitors").insert({
        device_id: device.device_id, device_name: device.name,
        full_name: typeof body?.full_name === "string" ? body.full_name.slice(0, 120) : null,
        phone: typeof body?.phone === "string" ? body.phone.slice(0, 32) : null,
        purpose: typeof body?.purpose === "string" ? body.purpose.slice(0, 300) : null,
        direction: body?.direction === "out" ? "out" : "in",
        snapshot_url: snapshotUrl,
      });
      return json({
        result: "ok", visitor: true,
        message: "บันทึกผู้มาติดต่อแล้ว กรุณาติดต่อเจ้าหน้าที่",
        speak: "บันทึกผู้มาติดต่อแล้ว",
        next_delay_seconds: Number(settings.next_person_delay_seconds) || 5,
      });
    }

    // ── คำสั่งค้างถึงเครื่อง ─────────────────────────────────────────────
    if (route === "door-command" || route === "power-command") {
      const kind = route === "door-command" ? "door" : "power";
      const { data, error:commandError } = await db
        .from("kiosk_commands")
        .select("id, action, payload")
        .eq("device_id", device.device_id).eq("kind", kind)
        .is("consumed_at", null)
        .gt("expires_at",new Date().toISOString())
        .order("created_at", { ascending: true }).limit(1);
      if(commandError)throw commandError;
      const cmd = (data as any[])?.[0];
      if (!cmd) return json({ command: null });
      const {error:consumeError}=await db.from("kiosk_commands").update({ consumed_at: new Date().toISOString() }).eq("id", cmd.id);
      if(consumeError)throw consumeError;
      return json({ command: cmd.action, action: cmd.action, ...(cmd.payload ?? {}) });
    }

    // ── ภาพสดหน้าตู้ ─────────────────────────────────────────────────────
    if (route === "live") {
      const image = typeof body?.image === "string" ? body.image.slice(0, 900_000) : null;
      if (!image) return json({ ok: false }, 400);
      const {error:liveError}=await db.from("kiosk_live_frames").upsert(
        { device_id: device.device_id, image, updated_at: new Date().toISOString() },
        { onConflict: "device_id" },
      );
      if(liveError)throw liveError;
      return json({ ok: true });
    }

    return json({ error: "unknown route", route }, 404);
  } catch (e) {
    console.error("[kiosk-api]", route, e);
    return json({ error: "server_error", details: String((e as Error)?.message ?? e) }, 500);
  }
});
