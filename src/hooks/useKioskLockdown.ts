import { useEffect } from "react";
import { installKioskLockdown, type KioskLockdownOptions } from "@/lib/kioskLockdown";

/** เปิด lockdown เบราว์เซอร์สำหรับหน้า kiosk (กันหลุดหน้าจอ / session end) */
export function useKioskLockdown(enabled: boolean, options: KioskLockdownOptions = {}) {
  const { blockUnload, keepFullscreen, keepSession, returnPath } = options;
  useEffect(() => {
    if (!enabled) return;
    return installKioskLockdown({ blockUnload, keepFullscreen, keepSession, returnPath });
  }, [enabled, blockUnload, keepFullscreen, keepSession, returnPath]);
}
