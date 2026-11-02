/** A project/configuration 404 is not proof that a particular device token expired. */
export function isExpiredFcmToken(body: string): boolean {
  try {
    const data = JSON.parse(body);
    return (data?.error?.details ?? []).some((d: { "@type"?: string; errorCode?: string }) =>
      d["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError" && d.errorCode === "UNREGISTERED");
  } catch { return false; }
}