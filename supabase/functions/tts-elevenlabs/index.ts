// ElevenLabs TTS — free-tier friendly. Returns MP3 bytes, or 429 on quota exhausted.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const VOICE_ID = "XrExE9yKIg1WjnnlVkGX"; // Matilda (multilingual)
const MODEL_ID = "eleven_turbo_v2_5"; // low-cost, supports Thai

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      // ไม่ได้ตั้งค่า key = ไม่ใช่ error ของระบบ — ให้ client ใช้เสียงในบราวเซอร์แทน (คืน 200)
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY not configured", fallback: true, quota: true, configured: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    const { text, voiceId } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hard cap for free tier safety (per request)
    const trimmed = text.slice(0, 500);

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: trimmed,
          model_id: MODEL_ID,
          voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.0 },
        }),
      }
    );

    if (!resp.ok) {
      const errBody = await resp.text();
      // Detect quota / free-tier exhaustion — tell client to fall back to speechSynthesis
      const isQuota =
        resp.status === 401 ||
        resp.status === 402 ||
        resp.status === 429 ||
        /quota|credit|exceed|limit|unauthorized|detected_unusual_activity/i.test(errBody);
      return new Response(
        JSON.stringify({ error: errBody, status: resp.status, fallback: isQuota, quota: isQuota }),
        {
          // คืน 200 เสมอเพื่อให้ client fallback ได้โดยไม่เกิด runtime error
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const audio = await resp.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message, fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
