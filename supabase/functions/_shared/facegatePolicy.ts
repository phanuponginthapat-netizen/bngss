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
export function validateFacegateSettings(settings: Record<string, unknown>) {
  for (const [key, low, high] of [['match_threshold',.3,.9],['detector_min_score',.3,.9],['geometry_weight',0,1],['geometry_min_score',0,1],['voice_volume',0,1],['voice_rate',.5,2],['door_open_seconds',1,30]] as const) {
    const value=Number(settings[key]);
    if(!Number.isFinite(value)||value<low||value>high)throw new Error(`ค่าตั้งค่า ${key} ไม่ถูกต้อง`);
  }
  if(![0,90,180,270].includes(Number(settings.kiosk_camera_rotate)))throw new Error('มุมกล้องไม่ถูกต้อง');
  facegateSaver(settings);
}