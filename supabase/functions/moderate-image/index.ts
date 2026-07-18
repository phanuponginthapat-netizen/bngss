// Image moderation via the shared AI provider fallback chain.
// Returns { safe: boolean, reason?: string, categories?: string[] }
import { aiCall } from "../_shared/aiCall.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ safe: true, reason: "no image" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a school content safety classifier. Analyze the image and decide if it is SAFE for a primary/secondary school feed.

UNSAFE categories (Thai school context):
- Nudity, sexual content, suggestive poses, underwear-only
- Graphic violence, blood, gore, weapons aimed at people
- Drug use, alcohol, smoking, vaping
- Hate symbols, gambling, profane gestures (middle finger)
- Self-harm, suicide imagery
- Disturbing/scary content not appropriate for children

Respond STRICTLY in JSON: {"safe": boolean, "reason": "ภาษาไทยสั้นๆ", "categories": ["..."]}`;

    const result = await aiCall({
      vision: true,
      json: true,
      temperature: 0.1,
      functionName: "moderate-image",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    const content = result.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { safe: true };
    }
    const safe = parsed.safe !== false;
    return new Response(
      JSON.stringify({
        safe,
        reason: parsed.reason || (safe ? "ผ่าน" : "พบเนื้อหาไม่เหมาะสม"),
        categories: parsed.categories || [],
        provider: result.provider,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("moderate-image error", e);
    return new Response(JSON.stringify({ safe: true, reason: "error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
