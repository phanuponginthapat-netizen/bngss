export function wallInteractionAllowed(readOnly: boolean, userId: string | null): boolean {
  return !readOnly && Boolean(userId);
}