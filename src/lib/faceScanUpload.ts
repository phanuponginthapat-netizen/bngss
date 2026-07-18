import { supabase } from "@/integrations/supabase/client";
import { todayBangkok } from "@/lib/dateBE";

/**
 * อัปโหลดรูปใบหน้าที่จับได้ (data URL) ขึ้น bucket `face-photos`
 * แล้วคืน signed URL อายุ 7 วัน เพื่อให้ LINE/แจ้งเตือนใช้แสดงรูปได้
 *
 * ถ้า input ว่าง / อัปโหลดล้มเหลว — คืนค่าเดิม (data URL หรือ null)
 * เพื่อไม่ให้ขัดการ insert log
 */
export async function uploadFaceScanSnapshot(
  dataUrl: string | undefined | null,
  studentId: string,
): Promise<string | null> {
  if (!dataUrl) return null;
  // already an https URL — pass through
  if (/^https?:\/\//i.test(dataUrl)) return dataUrl;
  if (!dataUrl.startsWith("data:")) return dataUrl;

  try {
    // dataURL -> Blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const today = todayBangkok();
    const ts = Date.now();
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const path = `scans/${today}/${studentId}-${ts}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("face-photos")
      .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
    if (upErr) {
      console.warn("[faceScanUpload] upload failed:", upErr.message);
      return dataUrl;
    }

    // 7 days signed URL — LINE caches at delivery time
    const { data: signed } = await supabase.storage
      .from("face-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    return signed?.signedUrl || dataUrl;
  } catch (e) {
    console.warn("[faceScanUpload] error:", e);
    return dataUrl;
  }
}
