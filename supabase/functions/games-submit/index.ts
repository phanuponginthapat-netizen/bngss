// games-submit: บันทึกคะแนนจากเกมภายนอกโดยตรวจ session_token + API key
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeadersWithHubKey as corsHeaders } from "../_shared/cors.ts";

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyToken(token: string, secret: string) {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = (await sha256Hex(body + "|" + secret)).slice(0, 32);
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(atob(body));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload as { sid: string; kid: string; exp: number };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const hubKey = req.headers.get("x-hub-key") || "";
    if (!hubKey) return json({ error: "missing_api_key" }, 401);

    const { session_token, game_id, score, duration_sec, meta } = await req.json().catch(() => ({}));
    if (!session_token || !game_id || typeof score !== "number") return json({ error: "invalid_input" }, 400);
    if (!Number.isFinite(score) || score < 0 || score > 1_000_000_000) return json({ error: "invalid_score" }, 400);

    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const payload = await verifyToken(session_token, secret);
    if (!payload) return json({ error: "invalid_or_expired_token" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secret);

    const keyHash = await sha256Hex(hubKey);
    const { data: apiKey } = await admin
      .from("game_hub_api_keys")
      .select("id, is_active")
      .eq("key_hash", keyHash)
      .maybeSingle();
    if (!apiKey || !apiKey.is_active || apiKey.id !== payload.kid) return json({ error: "invalid_api_key" }, 401);

    const { data: game } = await admin.from("game_hub_games").select("id, is_active, play_count").eq("id", game_id).maybeSingle();
    if (!game || !game.is_active) return json({ error: "game_not_found" }, 404);

    const { error } = await admin.from("game_hub_scores").insert({
      game_id,
      student_id: payload.sid,
      score,
      duration_sec: duration_sec ?? null,
      meta: meta ?? {},
      source: "external",
    });
    if (error) {
      console.error("game_hub_scores insert failed:", error.message);
      return json({ error: "insert_failed" }, 500);
    }

    await admin.from("game_hub_games").update({ play_count: (game.play_count ?? 0) + 1 }).eq("id", game_id);
    await admin.from("game_hub_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);

    return json({ success: true });
  } catch (_e) {
    return json({ error: "internal_error" }, 500);
  }
});
