import { useEffect, useState } from "react";

/**
 * ตรวจว่าจอปัจจุบันเป็นแนวตั้ง (portrait) หรือแนวนอน (landscape)
 * ใช้กับตู้ Kiosk ที่วางจอได้ทั้ง 2 แบบ — อัปเดตทันทีเมื่อหมุนจอ/เปลี่ยนขนาด
 */
export function useIsPortrait(): boolean {
  const [portrait, setPortrait] = useState(() =>
    typeof window === "undefined" ? false : window.innerHeight >= window.innerWidth,
  );

  useEffect(() => {
    const update = () => setPortrait(window.innerHeight >= window.innerWidth);
    update();
    const mq = window.matchMedia("(orientation: portrait)");
    mq.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      mq.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return portrait;
}
