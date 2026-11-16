/** Require server-returned rows before announcing a targeted write as successful. */
export function requireWrittenRows(result: { data: unknown[] | null; error: unknown }) {
  if (result.error) throw result.error;
  if (!result.data?.length) throw new Error("ไม่พบรายการที่บันทึกได้ หรือคุณไม่มีสิทธิ์ กรุณาโหลดข้อมูลใหม่แล้วลองอีกครั้ง");
  return result.data;
}
