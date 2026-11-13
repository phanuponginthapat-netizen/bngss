export const FACEGATE_PAUSE_SECONDS = 2;
export function validFacegateCommand(kind: unknown, action: unknown) {
  return kind === "door" ? ["open", "free", "lock"].includes(String(action))
    : kind === "power" && ["screen_on", "screen_off", "sleep", "shutdown", "cancel", "wake", "prepare_voice", "test_voice", "live_view"].includes(String(action));
}
export function validWakePayload(value: unknown): value is {wake_mac:string} {
  return !!value && typeof value === 'object' && 'wake_mac' in value && /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(String(value.wake_mac));
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
}const hhmm=(v:unknown)=>{const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(v??''));return m?Number(m[1])*60+Number(m[2]):null;};
/** Daily power plan in Bangkok minutes; windows may cross midnight. Invalid times disable that part. */
export function facegatePowerPlan(settings: Record<string, unknown>, minute: number) {
  const enabled = settings.power_saving_enabled === true;
  const off = hhmm(settings.screen_off_time), on = hhmm(settings.screen_on_time), shut = hhmm(settings.power_off_time);
  const inWindow = off !== null && on !== null && off !== on && (off < on ? minute >= off && minute < on : minute >= off || minute < on);
  const due = shut !== null && ((minute - shut + 1440) % 1440) < 10;
  return { power_saving_enabled: enabled, screen_idle_minutes: Math.max(0, Math.min(240, Number(settings.screen_idle_minutes) || 0)),
    screen_off_window: enabled && inWindow, power_off_due: enabled && due,
    power_off_action: settings.power_off_action === 'sleep' ? 'sleep' : 'shutdown' };
}
export function validateFacegatePower(settings: Record<string, unknown>) {
  for (const k of ['screen_off_time','screen_on_time','power_off_time']) if (settings[k] && hhmm(settings[k]) === null) throw new Error('เวลาพลังงานต้องเป็น ชช:นน');
  const idle = Number(settings.screen_idle_minutes ?? 0); if (!Number.isFinite(idle) || idle < 0 || idle > 240) throw new Error('นาทีพักจอไม่ถูกต้อง');
}
