export function canTestNotification(userId: string | null | undefined, busy: boolean, native: boolean, webStatus: string): boolean {
  return !!userId && !busy && (native || webStatus === "subscribed");
}