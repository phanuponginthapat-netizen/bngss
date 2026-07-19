import { getSecret, invalidateSecretCache } from "../_shared/getSecret.ts";
import { secretKeys } from "../_shared/secretKeys.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { generateVapidPair } from "../_shared/provisionSecrets.ts";

// Returns the configured web-push public key for the browser to subscribe with.
// Auto-generates and persists a VAPID keypair on first call so a freshly-remixed
// project can subscribe to push notifications without any manual setup.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let key = await getSecret(secretKeys.vapidPublic);
  if (!key) {
    try {
      const pair = await generateVapidPair();
      invalidateSecretCache(secretKeys.vapidPublic);
      invalidateSecretCache(secretKeys.vapidPrivate);
      key = pair.publicKey;
    } catch (e) {
      return new Response(JSON.stringify({ error: "vapid_generation_failed", detail: String((e as Error)?.message || e) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ publicKey: key }), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
});
