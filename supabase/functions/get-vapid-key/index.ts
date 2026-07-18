import { getSecret } from "../_shared/getSecret.ts";
import { secretKeys } from "../_shared/secretKeys.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Returns the configured web-push public key for the browser to subscribe with.
// Falls back to the project default if no custom key is set.

const DEFAULT_WEB_PUSH_PUBLIC_KEY =
  "BBMeUAOraQHGtdw31hIdhUwVLAQoy6Rzu2o6eTbhYByjG_6t6gwNSLzlp-T2ZWhl9arfDzQcNtQu6mJt3jUrxyI";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = (await getSecret(secretKeys.vapidPublic)) || DEFAULT_WEB_PUSH_PUBLIC_KEY;
  return new Response(JSON.stringify({ publicKey: key }), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
});
