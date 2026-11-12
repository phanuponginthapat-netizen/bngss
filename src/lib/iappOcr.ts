import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { AiAttachment } from "./aiAttachments";
import { validateAttachmentText } from "./aiAttachments";

export const IAPP_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.bmp";
export async function readIappAttachment(file: File): Promise<AiAttachment> {
  if (!file.size || file.size > 8 * 1024 * 1024) throw new Error("ไฟล์ต้องไม่ว่างและไม่เกิน 8MB");
  const body = new FormData(); body.append("file", file); body.append("consent", "true");
  const { data, error } = await supabase.functions.invoke("iapp-document-markdown", { body });
  if (error) {
    let message = "อ่านเอกสารด้วย iApp ไม่สำเร็จ กรุณาลองใหม่";
    if (error instanceof FunctionsHttpError) {
      const details = await error.context.json().catch(() => null);
      if (typeof details?.error === "string") message = details.error;
    }
    throw new Error(message);
  }
  if (!data || typeof data.text !== "string") throw new Error("iApp ไม่ได้ส่งข้อความเอกสารกลับมา");
  return { name: file.name, text: validateAttachmentText(data.text) };
}