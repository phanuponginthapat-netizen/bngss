/**
 * Native camera bridge (Capacitor) พร้อม fallback เป็นเว็บ
 *
 * เมื่อรันเป็นแอป APK/iOS จะใช้กล้องของระบบผ่าน @capacitor/camera
 * (ได้ความละเอียดเต็ม + โฟกัสอัตโนมัติของกล้องเนทีฟ) — ถ้ารันบนเว็บจะใช้
 * <input type="file" capture> ตามเดิม
 */

export function isNativeApp(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = (window as any).Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** ถ่ายรูปด้วยกล้องเนทีฟ คืนค่าเป็น data URL (คืน null ถ้าไม่ใช่แอปเนทีฟ/ผู้ใช้ยกเลิก) */
export async function takeNativePhoto(opts?: { front?: boolean; quality?: number }): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const mod = await import("@capacitor/camera");
    const { Camera, CameraResultType, CameraSource, CameraDirection } = mod;
    const photo = await Camera.getPhoto({
      quality: opts?.quality ?? 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      direction: opts?.front ? CameraDirection.Front : CameraDirection.Rear,
      correctOrientation: true,
    });
    return photo.dataUrl ?? null;
  } catch {
    return null;
  }
}

/** ขอสิทธิ์กล้องล่วงหน้า (เฉพาะแอปเนทีฟ) */
export async function ensureNativeCameraPermission(): Promise<boolean> {
  if (!isNativeApp()) return true;
  try {
    const { Camera } = await import("@capacitor/camera");
    const status = await Camera.checkPermissions();
    if (status.camera === "granted") return true;
    const req = await Camera.requestPermissions({ permissions: ["camera"] });
    return req.camera === "granted";
  } catch {
    return false;
  }
}
