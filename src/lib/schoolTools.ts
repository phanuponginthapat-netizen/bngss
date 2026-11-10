import { supabase } from "@/integrations/supabase/client";
import { createParser } from "eventsource-parser";
export type SchoolTool = "worksheet" | "lesson" | "quiz" | "grades";
export const schoolToolLabels = { worksheet: "สร้างใบงาน", lesson: "สร้างแผนการสอน", quiz: "สร้างข้อสอบฝึกทบทวน", grades: "สรุปผลการเรียน" };
export async function streamSchoolTool(body: { tool: SchoolTool; topic: string; grade: string; count: number }, onText: (text: string) => void) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-school-tools`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `สร้างงานไม่สำเร็จ (${response.status})`);
  }
  if (!response.body) throw new Error("ไม่พบคำตอบจาก AI");
  let text = ""; let done = false; let error = "";
  const parser = createParser({ onEvent(event) {
    const payload = JSON.parse(event.data);
    if (payload.type === "delta" && typeof payload.text === "string") { text += payload.text; onText(text); }
    if (payload.type === "done") done = true;
    if (payload.type === "error") error = payload.message || "สร้างงานไม่สำเร็จ";
  } });
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try { for (;;) { const chunk = await reader.read(); if (chunk.done) break; parser.feed(chunk.value); } }
  finally { await reader.cancel().catch(() => {}); }
  if (error) throw new Error(error);
  if (!done) throw new Error("การเชื่อมต่อขาดระหว่างสร้างงาน กรุณาตรวจข้อความก่อนลองใหม่");
  return text;
}