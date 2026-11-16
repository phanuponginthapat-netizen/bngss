import { createParser } from "eventsource-parser";
import { supabase } from "@/integrations/supabase/client";

export async function readChatStream(response: Response, onText: (text: string) => void) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `AI ไม่สามารถตอบได้ (${response.status})`);
  }
  if (!response.body) throw new Error("ไม่พบคำตอบจาก AI");
  let result: { reply: string; historySaved?: boolean } | undefined;
  let failure = "";
  const parser = createParser({ onEvent(event) {
    const body = JSON.parse(event.data);
    if (body.type === "delta" && typeof body.text === "string") onText(body.text);
    if (body.type === "done") { result = body; onText(body.reply); }
    if (body.type === "error") failure = body.message || "AI ไม่สามารถตอบได้";
  } });
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; parser.feed(chunk.value); if (result || failure) break; }
  } finally { await reader.cancel().catch(() => {}); }
  if (failure) throw new Error(failure);
  if (!result) throw new Error("การเชื่อมต่อขาดระหว่างตอบ กรุณาตรวจข้อความก่อนลองใหม่");
  return result;
}

export async function streamAiChat(messages: unknown[], onText: (text: string) => void) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({ messages, stream: true }),
  });
  return readChatStream(response, onText);
}