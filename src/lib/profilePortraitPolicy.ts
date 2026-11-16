export function canChangeOwnPortrait(role: string | null | undefined): boolean {
  return !!role && role !== 'student' && role !== 'parent' && role !== 'observer';
}