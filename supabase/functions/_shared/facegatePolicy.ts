export const FACEGATE_PAUSE_SECONDS = 2;
export function validFacegateCommand(kind: unknown, action: unknown) {
  return kind === "door" ? ["open", "free", "lock"].includes(String(action))
    : kind === "power" && ["screen_on", "screen_off", "sleep", "shutdown", "cancel"].includes(String(action));
}
export function facegateSaver(settings: Record<string, unknown>) {
  const minutes = Number(settings.idle_stats_minutes ?? 0);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 120) throw new Error("invalid idle minutes");
  return { screensaver_mode: settings.screensaver_mode === "stats" ? "stats" : "off", idle_stats_minutes: minutes };
}