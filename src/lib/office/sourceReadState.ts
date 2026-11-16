export function requireOfficeSourceReady(loading: boolean, error: string | null): void {
  if (loading) throw new Error("กำลังอ่านไฟล์ กรุณารอให้เปิดสำเร็จก่อน");
  if (error) throw new Error("เปิดไฟล์ไม่สำเร็จ กรุณาลองใหม่ก่อนบันทึกหรือส่งออก");
}