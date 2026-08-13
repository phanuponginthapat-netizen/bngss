// Dynamic PWA manifest — reads school name/logo/theme from CMS settings.
// Served with a stable URL so Android/iOS treat the app as the same identity
// across reloads (identity = manifest URL). Contents change; URL doesn't.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Origin ของหน้าเว็บที่โหลด manifest — ใช้ตั้ง start_url/scope ให้ตรง document origin
  // (สเปก PWA: start_url ต้องเป็น same-origin กับ document)
  const url = new URL(req.url);
  const originParam = url.searchParams.get("origin");
  const referer = req.headers.get("referer");
  let appOrigin = originParam || (referer ? new URL(referer).origin : "");
  if (!appOrigin) {
    const { getPublicOrigin } = await import("../_shared/appConfig.ts");
    appOrigin = await getPublicOrigin();
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rows } = await admin
    .from("cms_settings")
    .select("key,value")
    .in("key", [
      "app_name",
      "app_short_name",
      "app_favicon_url",
      "hero_title",
      "hero_subtitle",
      "school_name",
      "school_short_name",
      "school_logo",
      "school_logo_512",
      "primary_color",
      "theme_color",
      "theme_primary_color",
      "background_color",
      "school_description",
    ]);

  const map: Record<string, string> = {};
  (rows || []).forEach((r: any) => { if (r?.value) map[r.key] = r.value; });

  // Fallback to schools table if CMS empty
  let schoolName = "", schoolShort = "", schoolLogo = "";
  if (!map.school_name || !map.school_logo) {
    const { data: school } = await admin
      .from("schools")
      .select("school_name, short_name, logo_url")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (school) {
      schoolName = school.school_name || "";
      schoolShort = school.short_name || "";
      schoolLogo = school.logo_url || "";
    }
  }

  // ชื่อ PWA ใช้ค่าจาก CMS (app_name) เป็นหลัก ให้ตรงกับ branding ฝั่งเว็บ
  // fallback → hero_title → school_name → schools table → default
  const name = map.app_name || map.hero_title || map.school_name || schoolName || "ระบบจัดการโรงเรียน";
  // short_name: ถ้าไม่มีค่าใน CMS ให้ตัดที่ขอบคำ (ไม่ตัดกลางคำแบบ "BNG Smart Sc")
  const autoShort = name.length > 12
    ? (name.slice(0, 12).replace(/\s+\S*$/, "") || name.slice(0, 12)).trim()
    : name;
  const shortName = map.app_short_name || map.school_short_name || schoolShort || autoShort;
  const themeColor = map.theme_color || map.primary_color || map.theme_primary_color || "#2563EB";
  const bgColor = map.background_color || "#FFFFFF";
  const description = map.hero_subtitle || map.school_description || `${name} — ระบบบริหารจัดการโรงเรียน`;
  const logo512 = map.school_logo_512 || map.school_logo || map.app_favicon_url || schoolLogo;
  const logo192 = map.school_logo || map.school_logo_512 || map.app_favicon_url || schoolLogo;

  // ถ้าไม่มีโลโก้ CMS ให้ใช้ไอคอน default ที่โฮสต์บน app origin
  const icon192 = logo192 || `${appOrigin}/icon-192.png`;
  const icon512 = logo512 || `${appOrigin}/icon-512.png`;

  const manifest = {
    // id/start_url/scope ต้อง same-origin กับหน้าเว็บ — ใช้ appOrigin
    id: `${appOrigin}/`,
    name,
    short_name: shortName,
    description,
    start_url: `${appOrigin}/?source=pwa`,
    scope: `${appOrigin}/`,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: bgColor,
    theme_color: themeColor,
    lang: "th",
    dir: "ltr",
    categories: ["education", "productivity"],
    prefer_related_applications: false,
    launch_handler: { client_mode: ["focus-existing", "auto"] },
    handle_links: "preferred",
    edge_side_panel: { preferred_width: 480 },
    shortcuts: [
      { name: "แดชบอร์ด", short_name: "Dashboard", url: `${appOrigin}/dashboard?source=pwa_shortcut`,
        icons: [{ src: icon192, sizes: "192x192" }] },
      { name: "กล่องข้อความ", short_name: "Inbox", url: `${appOrigin}/inbox?source=pwa_shortcut`,
        icons: [{ src: icon192, sizes: "192x192" }] },
      { name: "เช็คชื่อ", short_name: "Attendance", url: `${appOrigin}/student/attendance?source=pwa_shortcut`,
        icons: [{ src: icon192, sizes: "192x192" }] },
    ],
    icons: [
      // เฉพาะ purpose "any" — คงโลโก้พื้นหลังใสตามที่ผู้ใช้อัปโหลด
      // (ไม่ประกาศ maskable เพราะบังคับให้ OS วาดพื้นหลังทึบเต็มกรอบ)
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" },
    ],

  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      ...cors,
      "Content-Type": "application/manifest+json; charset=utf-8",
      // Short cache so CMS edits reflect quickly, but not zero (avoid hammering DB)
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
});
