// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { readChatStream } from "../aiChatStream";
import { answerMode } from "../../../supabase/functions/ai-chat/promptPolicy";

describe("shared chat completion", () => {
  it("shows text before the durable final response", async () => {
    const encoder = new TextEncoder();
    let finish: (() => void) | undefined;
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"delta","text":"คำตอบ"}\n\n'));
      finish = () => { controller.enqueue(encoder.encode('data: {"type":"done","reply":"คำตอบ","historySaved":true}\n\n')); controller.close(); };
    } });
    const received: string[] = [];
    const pending = readChatStream(new Response(stream), text => { received.push(text); if (received.length === 1) finish?.(); });
    expect((await pending).historySaved).toBe(true);
    expect(received[0]).toBe("คำตอบ");
  });
  it("does not treat a disconnected partial reply as saved success", async () => {
    const response = new Response('data: {"type":"delta","text":"partial"}\n\n');
    await expect(readChatStream(response, () => {})).rejects.toThrow("การเชื่อมต่อขาด");
  });
  it("surfaces terminal quota failure", async () => {
    await expect(readChatStream(new Response('data: {"type":"error","message":"ครบ30ข้อความ"}\n\n'), () => {})).rejects.toThrow("ครบ30ข้อความ");
  });
  it("finishes on done without waiting for the server connection to close", async () => {
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"type":"done","reply":"ตอบแล้ว","historySaved":true}\n\n'));
    } });
    expect((await readChatStream(new Response(stream), () => {})).reply).toBe('ตอบแล้ว');
  });
  it("clears terminal failure without waiting for connection closure", async () => {
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"type":"error","message":"ตอบไม่สำเร็จ"}\n\n'));
    } });
    await expect(readChatStream(new Response(stream), () => {})).rejects.toThrow('ตอบไม่สำเร็จ');
  });
  it.each(["admin","director","teacher","student","parent","alumni","observer"])("keeps %s general chat available", role => {
    expect(answerMode("สวัสดี",role)).toBe("general");
  });
});