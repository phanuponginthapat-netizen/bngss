/** Observer credentials are administered only by a server-verified admin. */
export async function authorizeObserverAdmin(db: any, token: string): Promise<string | null> {
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: roles, error: roleError } = await db.from("user_roles").select("role").eq("user_id", data.user.id);
  if (roleError || !roles?.some((row: {role: string}) => row.role === "admin")) return null;
  return data.user.id;
}