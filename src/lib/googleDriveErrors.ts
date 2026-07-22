export const DRIVE_RECONNECT_REASON = "Google Drive ต้องเชื่อมต่อใหม่";
export const DRIVE_RECONNECT_HINT = "บัญชี Drive ที่เคยเชื่อมไว้ใช้ไม่ได้แล้ว กรุณากดเชื่อม Google Drive ใหม่อีกครั้ง";

export function isDriveCredentialMissingError(value: unknown): boolean {
  const raw = typeof value === "string"
    ? value
    : value instanceof Error
      ? value.message
      : (() => {
          try { return JSON.stringify(value); } catch { return String(value); }
        })();

  return /app_user_credential_missing|App user credential not found|not_connected|GOOGLE_DRIVE_NOT_CONNECTED|reconnect_required/i.test(raw);
}

export function driveReconnectMessage() {
  return `${DRIVE_RECONNECT_REASON}: ${DRIVE_RECONNECT_HINT}`;
}