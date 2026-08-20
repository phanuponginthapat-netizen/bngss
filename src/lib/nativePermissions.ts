/**
 * Native (APK/iOS) permission bridge
 *
 * ปัญหาเดิมบน APK:
 *  - โค้ดหลายหน้าเรียก `navigator.geolocation` ตรง ๆ → WebView ของ Capacitor
 *    จะไม่ขอสิทธิ์ตำแหน่งของ "ระบบ" ให้ ทำให้ลงเวลา/เยี่ยมบ้าน/แผนที่ ค้างหรือ error
 *  - โค้ดหลายหน้าเรียก `getUserMedia` ตรง ๆ → ถ้ายังไม่ได้ขอสิทธิ์กล้อง/ไมค์ระดับ OS
 *    กล้องจะเปิดไม่ขึ้น (NotAllowedError)
 *
 * ไฟล์นี้ patch API ของเบราว์เซอร์ให้วิ่งผ่าน Capacitor เมื่ออยู่ในแอปเนทีฟ
 * (บนเว็บจะไม่ทำอะไรเลย)
 */

function isNative(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

let installed = false;

export function installNativePermissionBridge() {
  if (installed || typeof window === "undefined" || !isNative()) return;
  installed = true;

  patchGeolocation();
  patchGetUserMedia();
}

/* ---------------- Geolocation ---------------- */

type PosCb = (pos: GeolocationPosition) => void;
type ErrCb = (err: GeolocationPositionError) => void;

function toGeoPosition(p: {
  coords: { latitude: number; longitude: number; accuracy: number; altitude?: number | null; altitudeAccuracy?: number | null; heading?: number | null; speed?: number | null };
  timestamp: number;
}): GeolocationPosition {
  return {
    coords: {
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      accuracy: p.coords.accuracy,
      altitude: p.coords.altitude ?? null,
      altitudeAccuracy: p.coords.altitudeAccuracy ?? null,
      heading: p.coords.heading ?? null,
      speed: p.coords.speed ?? null,
      toJSON() { return this; },
    },
    timestamp: p.timestamp,
    toJSON() { return this; },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function geoError(message: string, code = 1): GeolocationPositionError {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as any;
}

async function ensureLocationPermission(): Promise<boolean> {
  const { Geolocation } = await import("@capacitor/geolocation");
  try {
    const st = await Geolocation.checkPermissions();
    if (st.location === "granted" || st.coarseLocation === "granted") return true;
  } catch { /* ขอใหม่ด้านล่าง */ }
  try {
    const req = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
    return req.location === "granted" || req.coarseLocation === "granted";
  } catch {
    return false;
  }
}

function patchGeolocation() {
  const watchers = new Map<number, string>();
  let nextId = 1;

  const impl: Partial<Geolocation> = {
    getCurrentPosition: (success: PosCb, error?: ErrCb, options?: PositionOptions) => {
      (async () => {
        try {
          if (!(await ensureLocationPermission())) {
            error?.(geoError("ยังไม่ได้อนุญาตให้เข้าถึงตำแหน่ง", 1));
            return;
          }
          const { Geolocation } = await import("@capacitor/geolocation");
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: options?.enableHighAccuracy ?? true,
            timeout: options?.timeout ?? 15000,
            maximumAge: options?.maximumAge ?? 10000,
          });
          success(toGeoPosition(pos));
        } catch (e) {
          error?.(geoError((e as Error)?.message || "ระบุตำแหน่งไม่สำเร็จ", 2));
        }
      })();
    },

    watchPosition: (success: PosCb, error?: ErrCb, options?: PositionOptions) => {
      const id = nextId++;
      (async () => {
        try {
          if (!(await ensureLocationPermission())) {
            error?.(geoError("ยังไม่ได้อนุญาตให้เข้าถึงตำแหน่ง", 1));
            return;
          }
          const { Geolocation } = await import("@capacitor/geolocation");
          const watchId = await Geolocation.watchPosition(
            {
              enableHighAccuracy: options?.enableHighAccuracy ?? true,
              timeout: options?.timeout ?? 20000,
              maximumAge: options?.maximumAge ?? 5000,
            },
            (pos, err) => {
              if (err || !pos) {
                error?.(geoError((err as Error)?.message || "สัญญาณ GPS ขาดหาย", 2));
                return;
              }
              success(toGeoPosition(pos));
            },
          );
          if (watchers.has(id)) {
            // ถูกยกเลิกก่อนที่ watcher จะพร้อม
            await Geolocation.clearWatch({ id: watchId });
            watchers.delete(id);
          } else {
            watchers.set(id, watchId);
          }
        } catch (e) {
          error?.(geoError((e as Error)?.message || "ติดตามตำแหน่งไม่สำเร็จ", 2));
        }
      })();
      return id;
    },

    clearWatch: (id: number) => {
      const watchId = watchers.get(id);
      watchers.delete(id);
      if (!watchId) {
        // mark as cancelled ถ้ายังลงทะเบียนไม่เสร็จ
        watchers.set(id, "");
        return;
      }
      import("@capacitor/geolocation")
        .then(({ Geolocation }) => Geolocation.clearWatch({ id: watchId }))
        .catch(() => {});
    },
  };

  try {
    Object.defineProperty(navigator, "geolocation", { value: impl, configurable: true });
  } catch {
    // บางเครื่องกำหนดค่าไม่ได้ — ปล่อยใช้ของเดิม
  }
}

/* ---------------- Camera / Microphone ---------------- */

function patchGetUserMedia() {
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) return;
  const original = md.getUserMedia.bind(md);

  md.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    try {
      if (constraints?.video) {
        const { Camera } = await import("@capacitor/camera");
        const st = await Camera.checkPermissions();
        if (st.camera !== "granted") await Camera.requestPermissions({ permissions: ["camera"] });
      }
    } catch { /* ถ้าขอไม่ได้ ให้ getUserMedia รายงาน error เอง */ }
    return original(constraints);
  };
}
