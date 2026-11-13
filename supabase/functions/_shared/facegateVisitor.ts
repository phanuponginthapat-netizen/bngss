export function validVisitorPhoto(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 1_400_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
export function visitorRegistrationApproval(consent: boolean, photo: unknown, now: string) {
  return { face_approved_at: consent && validVisitorPhoto(photo) ? now : null, face_approved_by: null };
}
export function activeVisitorFace(visit: {face_consent?: boolean; face_approved_at?: string | null; check_out?: string | null; check_in?: string}, today: string) {
  if (!visit.face_consent || !visit.face_approved_at || visit.check_out || !visit.check_in) return false;
  const date = new Date(visit.check_in);
  return Number.isFinite(date.getTime()) && new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Bangkok'}).format(date) === today;
}
export function validFaceEmbedding(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 512 && value.every(n => typeof n === 'number' && Number.isFinite(n)) && value.some(n => n !== 0);
}