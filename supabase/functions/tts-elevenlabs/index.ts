// ElevenLabs TTS with graceful degradation.
// Returns audio/mpeg on success, or JSON { fallback: true } so the client can
// fall back to tts-th / browser speech synthesis without showing an error.
import { getSecret } from "../_shared/getSecret.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = buildCorsHeaders([], "POST, OPTIONS");
const DEFAULT_VOICE = "XrExE9yKIg1WjnnlVkGX"; // Matilda — works well for Thai
const DEFAULT_MODEL = "eleven_multilingual_v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? "").trim().slice(0, 900);
    if (!text) return json({ fallback: true, reason: "empty text" });

    const apiKey = (await getSecret("ELEVENLABS_API_KEY")) || Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) return json({ fallback: true, reason: "no api key" });

    const voiceId = String(body?.voiceId || DEFAULT_VOICE);
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: String(body?.modelId || DEFAULT_MODEL),
        voice_settings: { stability: 0.4, similarity_boost: 0.8, speed: Number(body?.speed) || 1.0 },
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      const quota = res.status === 429 || detail.includes("quota");
      return json({ fallback: true, quota, status: res.status, reason: detail }, quota ? 429 : 200);
    }

    const audio = new Uint8Array(await res.arrayBuffer());
    if (audio.byteLength < 100) return json({ fallback: true, reason: "empty audio" });
    return new Response(audio, { headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    return json({ fallback: true, reason: String(e) });
  }
});
