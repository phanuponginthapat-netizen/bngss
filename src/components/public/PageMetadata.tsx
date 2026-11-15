import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { useCmsSettingsBulk } from "@/hooks/useCmsSettings";

export const PUBLIC_PAGE_TITLES: Record<string, string> = {
  "/": "โรงเรียนบ้านหนองเงือก",
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
};

export default function PageMetadata({ title, description, schema }: {
  title?: string;
  description?: string;
  schema?: Record<string, unknown>;
}) {
  const { pathname } = useLocation();
  const { data: settings } = useCmsSettingsBulk();
  const school = settings?.school_name || "โรงเรียนบ้านหนองเงือก";
  const page = title || PUBLIC_PAGE_TITLES[pathname] || settings?.app_name || "BNG Smart School";
  const fullTitle = page === school ? `${school} | BNG Smart School` : `${page} | ${school}`;
  const summary = description || (pathname === "/"
    ? `ติดตามข่าวสาร กิจกรรม ปฏิทิน และข้อมูลบุคลากรของ${school} พร้อมบริการ BNG Smart School สำหรับชุมชนโรงเรียน`
    : `อ่านข้อมูล${page}ของ${school} ผ่านเว็บไซต์ BNG Smart School พร้อมข่าวสารและช่องทางติดต่อโรงเรียน`);
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