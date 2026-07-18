// Unifies "ตราโรงเรียน / ตราครุฑ / โลโก้โรงเรียน" ระหว่างหน้าออกแบบต้นแบบ (designer)
// กับการเรนเดอร์ eform จริง: ทั้งสองที่จะดึงรูปจาก CMS อัตโนมัติโดยไม่ต้องสั่งทีละ template
//
// - In designer: ใช้ `buildSchoolAssetOverlayCSS()` ฉีดเข้าใน <style> ทับ placeholder
//   เพื่อให้เห็นรูปจริง โดยไม่กระทบ HTML ที่บันทึก
// - In renderer: ใช้ `replaceSchoolAssetTokens()` แทน <span data-eform-field="garuda_emblem">
//   ด้วย <img> ที่ใช้ URL จาก CMS

export interface SchoolAssetUrls {
  garuda_emblem?: string;
  school_seal?: string;
  school_logo?: string;
}

const ASSET_KEYS = ["garuda_emblem", "school_seal", "school_logo"] as const;
type AssetKey = (typeof ASSET_KEYS)[number];

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeCss = (s: string) => s.replace(/["\\]/g, "\\$&");

/** ฉีดเป็น <style> ในตัว designer เพื่อให้ placeholder แสดงรูปจริงทันทีโดยไม่แก้ HTML ต้นฉบับ */
export function buildSchoolAssetOverlayCSS(assets: SchoolAssetUrls | null | undefined): string {
  if (!assets) return "";
  const rules: string[] = [];
  for (const key of ASSET_KEYS) {
    const url = assets[key];
    if (!url) continue;
    rules.push(`
      [data-eform-field="${key}"] {
        background-image: url("${escapeCss(url)}");
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        color: transparent !important;
        border: none !important;
        text-indent: -9999px;
        overflow: hidden;
      }
    `);
  }
  return rules.join("\n");
}

/** แปลง <span data-eform-field="garuda_emblem" ...>[ครุฑ]</span> → <img src=... ขนาดตาม span เดิม> */
export function replaceSchoolAssetTokens(html: string, assets: SchoolAssetUrls | null | undefined): string {
  if (!html || !assets) return html;
  let out = html;
  for (const key of ASSET_KEYS) {
    const url = assets[key as AssetKey];
    if (!url) continue;
    const re = new RegExp(
      `<span([^>]*?)data-eform-field=["']${key}["']([^>]*)>[\\s\\S]*?</span>`,
      "gi",
    );
    out = out.replace(re, (_m, pre: string, post: string) => {
      const attrs = `${pre} ${post}`;
      const styleMatch = /style=["']([^"']*)["']/i.exec(attrs);
      // เอาเฉพาะ width/height ของ placeholder มาใส่ <img> เพื่อให้ขนาดคงเดิม
      const styleParts: string[] = [];
      if (styleMatch) {
        for (const part of styleMatch[1].split(";")) {
          const t = part.trim().toLowerCase();
          if (t.startsWith("width:") || t.startsWith("height:")) styleParts.push(part.trim());
        }
      }
      styleParts.push("object-fit:contain");
      styleParts.push("display:inline-block");
      styleParts.push("vertical-align:middle");
      return `<img src="${escapeAttr(url)}" alt="${key}" style="${styleParts.join(";")}" />`;
    });
  }
  return out;
}
