import { supabase } from "@/integrations/supabase/client";

const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * สร้าง URL สำหรับฝัง iframe ของสื่อ HTML/ZIP/PDF
 * - public → URL ปกติ
 * - school/parent → ต้องแนบ ?token=<access_token> เพราะ iframe sub-request ไม่ส่ง Authorization header
 */
export async function buildEntryUrl(contentId: string, isPublic: boolean): Promise<string> {
  const base = `${PROJECT_URL}/functions/v1/learning-proxy/${contentId}/`;
  if (isPublic) return base;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  return `${base}?token=${encodeURIComponent(token)}`;
}

export function generatePublicShareLink(slug: string) {
  return `${window.location.origin}/learn/${slug}`;
}

/**
 * แปลง YouTube URL → embed URL
 */
export function toYouTubeEmbed(url: string): string {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
    else if (u.searchParams.get("v")) id = u.searchParams.get("v")!;
    else if (u.pathname.includes("/embed/")) id = u.pathname.split("/embed/")[1];
    else if (u.pathname.includes("/shorts/")) id = u.pathname.split("/shorts/")[1];
    if (!id) return url;
    return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
  } catch { return url; }
}

export function toVimeoEmbed(url: string): string {
  try {
    const u = new URL(url);
    const id = u.pathname.split("/").filter(Boolean).pop();
    if (!id) return url;
    return `https://player.vimeo.com/video/${id}`;
  } catch { return url; }
}

export function getKindLabel(kind: string): string {
  return ({
    html_single: "HTML",
    html_zip: "เกม HTML",
    youtube: "YouTube",
    vimeo: "Vimeo",
    pdf: "PDF",
    embed: "ฝัง URL",
  } as Record<string,string>)[kind] || kind;
}

export function getVisibilityLabel(v: string): string {
  return ({
    school: "เฉพาะในโรงเรียน",
    parent: "นักเรียน + ผู้ปกครอง",
    public: "สาธารณะ (ลิงก์)",
  } as Record<string,string>)[v] || v;
}
