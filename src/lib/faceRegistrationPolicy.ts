/** UI capability only; database staff policies remain authoritative. */
export function canSaveFaceRegistration(role: string | null | undefined, readOnly = false): boolean {
  return !readOnly && (role === 'admin' || role === 'director' || role === 'teacher');
}