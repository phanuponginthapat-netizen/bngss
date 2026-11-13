export const FACEGATE_ALERT_COOLDOWN_SECONDS = 600;
export const KIOSK_OFFLINE_COOLDOWN_SECONDS = 1800;

export async function claimKioskNotification(db: any, deviceId: string, kind: "unknown_face" | "offline") {
  const key = `kiosk:${kind}:${deviceId}`;
  const { data, error } = await db.rpc("claim_kiosk_notification", {
    p_key: key,
    p_seconds: kind === "unknown_face" ? FACEGATE_ALERT_COOLDOWN_SECONDS : KIOSK_OFFLINE_COOLDOWN_SECONDS,
  });
  if (error) throw error;
  return data ? { key, token: data as string } : null;
}

export async function releaseKioskNotification(db: any, claim: { key: string; token: string }) {
  const { error } = await db.from("kiosk_notification_cooldowns").delete()
    .eq("notification_key", claim.key).eq("claim_token", claim.token);
  if (error) throw error;
}