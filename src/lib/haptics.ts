// Lightweight haptic feedback helper (no-op when unsupported)
export type HapticPattern = "light" | "medium" | "heavy" | "success" | "warning" | "error";

export function haptic(pattern: HapticPattern = "light") {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return;
  const map: Record<HapticPattern, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 35,
    success: [12, 40, 12],
    warning: [20, 60, 20],
    error: [40, 60, 40, 60, 40],
  };
  try { navigator.vibrate(map[pattern]); } catch {}
}
