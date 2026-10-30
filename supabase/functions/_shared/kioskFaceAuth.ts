/** Device credentials are server-validated; a browser's claimed role is never trusted. */
export async function authorizeKioskFace(req: Request, db: any): Promise<boolean> {
  const key = req.headers.get("x-device-key")?.trim();
  if (key) {
    const { data, error } = await db.from("kiosk_devices")
      .select("id, is_active").eq("device_key", key).maybeSingle();
    return !error && !!data && data.is_active === true;
  }
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth?.user) return false;
  const { data: roles, error } = await db.from("user_roles")
    .select("role").eq("user_id", auth.user.id);
  return !error && (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "director");
}