/**
 * Cross-device camera opener.
 *
 * รองรับกล้องหน้า/หลังหลายรูปแบบ: มือถือ Android/iOS, แท็บเล็ต, โน้ตบุ๊ก, USB webcam,
 * และเครื่องที่มีกล้องหลายตัว (ultra-wide / macro / IR) โดยใช้ "constraint ladder"
 * ไล่จากคุณภาพสูงสุดลงมาจนกว่าจะเปิดได้ ไม่ให้ตายเพราะ OverconstrainedError
 */

export type Facing = "user" | "environment";

export interface CameraInfo {
  deviceId: string;
  label: string;
  facing: Facing | "unknown";
}

const isSecure = () =>
  typeof window !== "undefined" &&
  (window.isSecureContext || location.hostname === "localhost");

export function hasCameraSupport(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function guessFacing(label: string): Facing | "unknown" {
  const l = label.toLowerCase();
  if (/front|user|face|หน้า|self/.test(l)) return "user";
  if (/back|rear|environment|world|หลัง/.test(l)) return "environment";
  return "unknown";
}

/** รายชื่อกล้องทั้งหมด (label จะว่างจนกว่าจะเคยขออนุญาตกล้องสำเร็จ) */
export async function listCameras(): Promise<CameraInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `กล้อง ${i + 1}`,
        facing: guessFacing(d.label),
      }));
  } catch {
    return [];
  }
}

export interface OpenCameraOptions {
  facing?: Facing;
  deviceId?: string;
  /** ความละเอียดที่อยากได้ (จะลดลงอัตโนมัติถ้าเครื่องไม่ไหว) */
  width?: number;
  height?: number;
  audio?: boolean;
}

function ladder(opts: OpenCameraOptions): MediaStreamConstraints[] {
  const { deviceId, facing = "user", width = 1280, height = 720 } = opts;
  const audio = !!opts.audio;
  const list: MediaStreamConstraints[] = [];

  if (deviceId) {
    // 1) ล็อกอุปกรณ์ที่ผู้ใช้เลือก (exact ก่อน แล้วค่อย ideal)
    list.push({ audio, video: { deviceId: { exact: deviceId }, width: { ideal: width }, height: { ideal: height } } });
    list.push({ audio, video: { deviceId: { ideal: deviceId } } });
  }

  // 2) ตาม facingMode พร้อมความละเอียด
  list.push({ audio, video: { facingMode: { ideal: facing }, width: { ideal: width }, height: { ideal: height } } });
  // 3) facingMode อย่างเดียว
  list.push({ audio, video: { facingMode: facing } });
  // 4) ขนาดเล็กลง (เครื่องเก่า/กล้องคุณภาพต่ำ)
  list.push({ audio, video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 } } });
  // 5) อะไรก็ได้
  list.push({ audio, video: true });

  return list;
}

export interface OpenCameraResult {
  stream: MediaStream;
  deviceId?: string;
  label?: string;
  facing: Facing;
}

/**
 * เปิดกล้องแบบทนทาน — ลองหลาย constraint จนกว่าจะสำเร็จ
 * โยน error เฉพาะกรณีผู้ใช้ปฏิเสธสิทธิ์ / ไม่มีกล้องจริง ๆ
 */
export async function openCamera(opts: OpenCameraOptions = {}): Promise<OpenCameraResult> {
  if (!hasCameraSupport()) {
    throw new Error(
      isSecure()
        ? "อุปกรณ์นี้ไม่รองรับการใช้กล้องในเบราว์เซอร์"
        : "ต้องเปิดผ่าน HTTPS จึงจะใช้กล้องได้"
    );
  }

  let lastErr: unknown = null;
  for (const c of ladder(opts)) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(c);
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings?.() ?? {};
      return {
        stream,
        deviceId: (settings as MediaTrackSettings).deviceId,
        label: track?.label,
        facing: ((settings as MediaTrackSettings).facingMode as Facing) || opts.facing || "user",
      };
    } catch (e) {
      lastErr = e;
      const name = (e as { name?: string })?.name;
      // ปฏิเสธสิทธิ์ / ไม่มีกล้อง → ลองต่อไปก็ไม่มีประโยชน์
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        throw new Error("ยังไม่ได้อนุญาตให้ใช้กล้อง กรุณากดอนุญาตในเบราว์เซอร์แล้วลองใหม่");
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        throw new Error("ไม่พบกล้องบนอุปกรณ์นี้");
      }
      // NotReadableError / OverconstrainedError / TrackStartError → ลองชุดถัดไป
    }
  }
  const msg = (lastErr as { message?: string })?.message || "ไม่ทราบสาเหตุ";
  throw new Error("เปิดกล้องไม่สำเร็จ: " + msg);
}

/** ปิดสตรีมและล้าง video element ให้เรียบร้อย */
export function stopStream(stream?: MediaStream | null, video?: HTMLVideoElement | null) {
  try { stream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
  if (video) {
    try {
      const s = video.srcObject as MediaStream | null;
      s?.getTracks().forEach((t) => t.stop());
    } catch { /* ignore */ }
    video.srcObject = null;
  }
}

/** หา deviceId ตัวถัดไปสำหรับปุ่ม "สลับกล้อง" */
export function nextCameraId(cams: CameraInfo[], currentId?: string): string | undefined {
  if (cams.length < 2) return undefined;
  const idx = cams.findIndex((c) => c.deviceId === currentId);
  return cams[(idx + 1 + cams.length) % cams.length]?.deviceId;
}
