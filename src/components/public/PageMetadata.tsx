import { Helmet } from "react-helmet-async";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useCmsSettingsBulk } from "@/hooks/useCmsSettings";

export const PUBLIC_PAGE_TITLES: Record<string, string> = {
  // หน้าแรก ("/") ใช้ชื่อโรงเรียนจาก CMS เสมอ ไม่เขียนชื่อตายไว้ที่นี่
  "/about/history": "ประวัติสถานศึกษา",
  "/about/vision": "วิสัยทัศน์และพันธกิจ",
  "/about/philosophy": "ปรัชญาของโรงเรียน",
  "/about/org-chart": "โครงสร้างการบริหาร",
  "/org-chart": "โครงสร้างการบริหาร",
  "/personnel": "บุคลากรของโรงเรียน",
  "/subject-groups": "กลุ่มสาระการเรียนรู้",
  "/news": "ข่าวสารและกิจกรรม",
  "/calendar": "ปฏิทินโรงเรียน",
  "/downloads": "เอกสารดาวน์โหลด",
  "/download-app": "ดาวน์โหลด BNG Smart School",
  "/faq": "คำถามที่พบบ่อย",
  "/contact": "ติดต่อโรงเรียน",
  "/pdpa": "นโยบายคุ้มครองข้อมูลส่วนบุคคล",
  "/find": "ค้นหาบุคคลในโรงเรียน",
  "/ar": "ผลงาน AR",
  "/help": "ศูนย์ช่วยเหลือ",
  "/install": "ติดตั้งแอปโรงเรียน",
  "/parent-app": "บริการผู้ปกครอง",
  "/visit": "ลงทะเบียนผู้มาติดต่อ",
  "/kiosk-tablet": "FaceGate จุดสแกนโรงเรียน",
  "/kiosk": "FaceGate จุดสแกนโรงเรียน",
  "/face-kiosk": "FaceGate จุดสแกนโรงเรียน",
  "/login": "เข้าสู่ระบบ",
  "/signup": "สมัครบัญชี",
  "/setup": "ตั้งค่าระบบโรงเรียน",
  "/link-account": "เชื่อมบัญชีโรงเรียน",
  "/liff": "บริการโรงเรียนผ่าน LINE",
  "/liff/leave": "แจ้งลานักเรียนผ่าน LINE",
  "/liff/grades": "ผลการเรียนผ่าน LINE",
  "/liff/attendance": "การมาเรียนผ่าน LINE",
};

export default function PageMetadata({ title, description, schema }: {
  title?: string;
  description?: string;
  schema?: Record<string, unknown>;
}) {
  const { pathname } = useLocation();
  useEffect(() => {
    // Static fallbacks remain in HTML for non-JS crawlers, but Helmet owns
    // the rendered head. Remove only unmanaged fallback tags after mounting.
    const selectors = ['meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:url"]', 'meta[property="og:type"]', 'meta[name="twitter:title"]', 'meta[name="twitter:description"]', 'script[type="application/ld+json"]'];
    for (const selector of selectors) {
      document.querySelectorAll(`${selector}:not([data-rh])`).forEach(node => node.remove());
    }
  }, [pathname]);
  const { data: settings } = useCmsSettingsBulk();
  const school = settings?.school_name || "โรงเรียน";
  const appName = settings?.app_name || school;
  const dynamicTitle = pathname.startsWith("/ar/p/") ? "งาน AR แหล่งเรียนรู้"
    : pathname.startsWith("/ar/") ? "สื่อ AR แหล่งเรียนรู้"
    : pathname.startsWith("/p/") ? "โปรไฟล์สาธารณะ"
    : pathname.startsWith("/asset/") ? "ข้อมูลวัสดุและครุภัณฑ์"
    : pathname.startsWith("/sdq-assess/") ? "แบบประเมิน SDQ"
    : pathname.startsWith("/page/") ? "ข้อมูลโรงเรียน"
    : pathname.startsWith("/dashboard") ? "พื้นที่ทำงานโรงเรียน"
    : "ไม่พบหน้าที่ต้องการ";
  const page = title || PUBLIC_PAGE_TITLES[pathname] || (pathname === "/" ? school : dynamicTitle);
  const fullTitle = page === school ? `${school} | ${appName}` : `${page} | ${school}`;
  const summary = description || (pathname === "/"
    ? `ติดตามข่าวสาร กิจกรรม ปฏิทิน และข้อมูลบุคลากรของ${school} พร้อมบริการ ${appName} สำหรับชุมชนโรงเรียน`
    : `${page} — ข้อมูลจาก${school} ผ่านเว็บไซต์ ${appName} พร้อมข่าวสารและช่องทางติดต่อโรงเรียน`);
  const url = `https://bngss.online${pathname}`;
  const schoolSchema = pathname === "/" ? {
    "@context": "https://schema.org", "@type": "School", name: school, url,
    ...(settings?.school_logo ? { logo: settings.school_logo } : {}),
    ...(settings?.school_address ? { address: settings.school_address } : {}),
    ...(settings?.school_phone ? { telephone: settings.school_phone } : {}),
    ...(settings?.school_email ? { email: settings.school_email } : {}),
  } : undefined;
  return <Helmet>
    <title>{fullTitle}</title>
    <meta name="description" content={summary} />
    <link rel="canonical" href={url} />
    <meta property="og:title" content={fullTitle} />
    <meta property="og:description" content={summary} />
    <meta property="og:url" content={url} />
    <meta property="og:type" content="website" />
    <meta name="twitter:title" content={fullTitle} />
    <meta name="twitter:description" content={summary} />
    {(schema || schoolSchema) && <script type="application/ld+json">{JSON.stringify(schema || schoolSchema).replace(/</g, "\\u003c")}</script>}
  </Helmet>;
}