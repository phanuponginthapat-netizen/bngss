/**
 * Camera focus/exposure helpers.
 *
 * เบราว์เซอร์บนมือถือหลายรุ่น (โดยเฉพาะ Android เก่า, iOS Safari) จะไม่เปิดโหมด
 * autofocus ต่อเนื่อง หรือไม่เปิด macro focus ให้เอง ทำให้เวลาเอากล้องไปจ่อ
 * QR/บาร์โค้ด/บัตรระยะใกล้ ๆ ภาพเบลอ ไม่โฟกัส
 *
 * ฟังก์ชันนี้พยายามใช้ `MediaStreamTrack.applyConstraints` กับ advanced
 * capabilities ที่รองรับ (focusMode, focusDistance, exposureMode, whiteBalanceMode,
 * zoom) — ถ้ารุ่นไหนไม่รองรับก็ข้ามไป ไม่ throw
 */

export type CameraFocusMode = "close" | "auto" | "far";

const MIN_KEYS = ["min"] as const;

function pickFocusDistance(caps: any, mode: CameraFocusMode): number | undefined {
  const fd = caps?.focusDistance;
  if (!fd || typeof fd.min !== "number") return undefined;
  // focusDistance หน่วยเป็นเมตร: ค่าน้อย = ใกล้ (macro), ค่ามาก = ไกล
  if (mode === "close") return fd.min;
  if (mode === "far") return typeof fd.max === "number" ? fd.max : undefined;
  // auto → ปล่อยให้ระบบจัดการ
  return undefined;
}

/** ให้กล้องปรับโฟกัสต่อเนื่อง + จ่อระยะใกล้ได้ (สำหรับสแกน QR/บาร์โค้ด/บัตร) */
export async function applyCameraFocus(
  stream: MediaStream | null | undefined,
  mode: CameraFocusMode = "close"
): Promise<void> {
  if (!stream) return;
  const track = stream.getVideoTracks?.()[0];
  if (!track || typeof (track as any).getCapabilities !== "function") return;

  let caps: any = {};
  try { caps = (track as any).getCapabilities?.() ?? {}; } catch { caps = {}; }

  const advanced: MediaTrackConstraintSet[] = [];

  // 1) focusMode: continuous > single-shot > manual
  if (Array.isArray(caps.focusMode)) {
    const preferred =
      caps.focusMode.includes("continuous")
        ? "continuous"
        : caps.focusMode.includes("single-shot")
        ? "single-shot"
        : caps.focusMode.includes("manual") && mode === "close"
        ? "manual"
        : undefined;
    if (preferred) advanced.push({ focusMode: preferred } as any);
  }

  // 2) focusDistance สำหรับ manual macro
  const fd = pickFocusDistance(caps, mode);
  if (typeof fd === "number") advanced.push({ focusDistance: fd } as any);

  // 3) exposure / white balance ต่อเนื่อง → ช่วยเรื่องแสงในระยะใกล้
  if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) {
    advanced.push({ exposureMode: "continuous" } as any);
  }
  if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes("continuous")) {
    advanced.push({ whiteBalanceMode: "continuous" } as any);
  }

  // 4) กันเผลอ digital zoom = 1 (บางรุ่นเปิดค้างจากแอปกล้อง native)
  if (caps.zoom && typeof caps.zoom.min === "number" && MIN_KEYS.length) {
    advanced.push({ zoom: caps.zoom.min } as any);
  }

  if (advanced.length === 0) return;

  try {
    await (track as any).applyConstraints({ advanced });
  } catch {
    // fallback: ลองใส่ทีละตัว รุ่นเก่าบางตัวไม่รับ array
    for (const c of advanced) {
      try { await (track as any).applyConstraints({ advanced: [c] }); } catch {}
    }
  }
}

/** ideal constraints ที่แนะนำสำหรับ getUserMedia (ก่อนเรียก applyCameraFocus) */
export const closeUpVideoConstraints: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1280 },
  height: { ideal: 720 },
  // hint ให้ browser เลือก autofocus mode ที่เหมาะ (Chrome รองรับบางส่วน)
  // @ts-ignore — ยังไม่อยู่ใน lib.dom แต่ Chrome/Edge ยอมรับ
  focusMode: "continuous",
  // @ts-ignore
  resizeMode: "none",
};
