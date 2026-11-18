/** Failed role reads are not evidence of a missing role or an invalid session. */
export function authRoleRead<T extends { role: string }>(result: {
  data: T[] | null;
  error: unknown;
}): T[] {
  if (result.error) throw result.error;
  if (!result.data) throw new Error("อ่านสิทธิ์ผู้ใช้ไม่สำเร็จ กรุณาลองใหม่");
  return result.data;
}