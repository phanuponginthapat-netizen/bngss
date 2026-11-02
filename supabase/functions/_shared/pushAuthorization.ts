/** Internal senders may fan out; signed-in users may only test their own devices. */
export async function authorizePushRecipient(req: Request, db: any, recipient: string, serviceKey: string): Promise<boolean> {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return false;
  if (serviceKey && token === serviceKey) return true;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return false;
  if (data.user.id === recipient) return true;
  const { data: roles, error: roleError } = await db.from("user_roles").select("role").eq("user_id", data.user.id);
  return !roleError && (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "director");
}