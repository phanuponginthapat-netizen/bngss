import { getSecret } from "../_shared/getSecret.ts";
import { secretKeys } from "../_shared/secretKeys.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Returns the configured web-push public key for the browser to subscribe with.
// Falls back to the project default if no custom key is set.

const DEFAULT_WEB_PUSH_PUBLIC_KEY =
  "BCIa1dd34IU9mPlIZfNYJlx3qG0tbWBVI887HnTRzY0-cU3E4SqaVyD5cG27-_p0mlv6XW81ltRRXMmdqXMr2ec";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = (await getSecret(secretKeys.vapidPublic)) || DEFAULT_WEB_PUSH_PUBLIC_KEY;
  return new Response(JSON.stringify({ publicKey: key }), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
});
