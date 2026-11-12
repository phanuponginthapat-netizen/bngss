export const facegateDefaults = {
  match_threshold: 0.45, detector_min_score: 0.5, require_liveness: true,
  geometry_weight: 0.3, geometry_min_score: 0.45, qr_card_enabled: true,
  voice_enabled: true, voice_volume: 1, voice_rate: 1,
  voice_welcome_text: "ยินดีต้อนรับ", voice_denied_text: "ไม่พบข้อมูลในทะเบียน กรุณาติดต่อเจ้าหน้าที่",
  voice_duplicate_text: "บันทึกเวลาไปแล้ว", kiosk_mirror: true, kiosk_camera_rotate: 0,
  door_enabled: false, door_open_seconds: 5, live_view_enabled: true,
};
export type FacegateSettings = typeof facegateDefaults;
export function facegateSettingsPatch(raw: FacegateSettings) {
  if (!Number.isFinite(raw.match_threshold) || raw.match_threshold < .3 || raw.match_threshold > .9) throw new Error("ความแม่นยำต้องอยู่ระหว่าง 0.3–0.9");
  if (![0, 90, 180, 270].includes(raw.kiosk_camera_rotate)) throw new Error("มุมกล้องไม่ถูกต้อง");
  for (const [value, low, high] of [[raw.detector_min_score,.3,.9], [raw.geometry_weight,0,1], [raw.geometry_min_score,0,1], [raw.voice_volume,0,1], [raw.voice_rate,.5,2], [raw.door_open_seconds,1,30]]) {
    if (!Number.isFinite(value) || value < low || value > high) throw new Error("ค่าตั้งค่าอยู่นอกช่วงที่อนุญาต");
  }
  return { ...raw, next_person_delay_seconds: 2 };
}