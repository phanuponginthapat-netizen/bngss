// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCreditImage, imageSettings } from "../../../supabase/functions/_shared/lovableImageSettings";
import { streamImage } from "../streamImage";

afterEach(() => vi.unstubAllGlobals());
describe("Lovable credit image generation", () => {
  it("uses the workspace image model and server key through the gateway", async () => {
    const request = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", request);
    await generateCreditImage("test-server-key", "นกฮูกอ่านหนังสือ");
    const [url, options] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ai.gateway.lovable.dev/v1/images/generations");
    expect(JSON.parse(String(options.body))).toEqual({ model: "openai/gpt-image-2.5-sunburst", prompt: "นกฮูกอ่านหนังสือ", stream: true, partial_images: 1 });
    expect(imageSettings.format).toBe("openai");
  });
  it("omits streaming parameters on the single recovery request", async () => {
    const request = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", request);
    await generateCreditImage("test-server-key", "owl", false);
    const [, options] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({ model: imageSettings.model, prompt: "owl" });
  });
  it("shows credit errors without replaying or substituting another provider", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ message: "Insufficient AI credits" }), { status: 402 }));
    vi.stubGlobal("fetch", request);
    await expect(streamImage("/image", { prompt: "owl" }, vi.fn())).rejects.toThrow("Insufficient AI credits");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not treat a partial image followed by refusal as a finished image or retry", async () => {
    const request = vi.fn(async () => new Response('event: image_generation.partial_image\ndata: {"b64_json":"YWJj"}\n\nevent: error\ndata: {"error":{"message":"Request refused"}}\n\n', { headers: { "Content-Type": "text/event-stream" } }));
    vi.stubGlobal("fetch", request);
    const frame = vi.fn();
    await expect(streamImage("/image", { prompt: "owl" }, frame)).rejects.toThrow("Request refused");
    expect(frame).toHaveBeenCalledWith("data:image/png;base64,YWJj", false);
    expect(request).toHaveBeenCalledTimes(1);
  });
});