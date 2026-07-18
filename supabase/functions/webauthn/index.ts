// WebAuthn (Passkey) registration + authentication
// Actions: register-options | register-verify | auth-options | auth-verify | list | delete
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "npm:@simplewebauthn/server@10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function jsonResp(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserFromAuthHeader(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await userClient.auth.getUser();
  return data.user ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, origin } = body;
    if (!action || !origin) return jsonResp({ error: "missing action/origin" }, 400);

    const url = new URL(origin);
    const rpID = url.hostname;
    const rpName = "Lovable School";

    // -------- REGISTER OPTIONS (logged-in user enrolling a new passkey) --------
    if (action === "register-options") {
      const user = await getUserFromAuthHeader(req);
      if (!user) return jsonResp({ error: "unauthorized" }, 401);

      const { data: existing } = await admin
        .from("webauthn_credentials")
        .select("credential_id, transports")
        .eq("user_id", user.id);

      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: new TextEncoder().encode(user.id),
        userName: user.email || user.id,
        attestationType: "none",
        excludeCredentials: (existing ?? []).map((c: any) => ({
          id: c.credential_id,
          transports: c.transports ?? undefined,
        })),
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      });

      await admin.from("webauthn_challenges").insert({
        user_id: user.id, challenge: options.challenge, kind: "register",
      });
      return jsonResp({ options });
    }

    // -------- REGISTER VERIFY --------
    if (action === "register-verify") {
      const user = await getUserFromAuthHeader(req);
      if (!user) return jsonResp({ error: "unauthorized" }, 401);
      const { response, deviceLabel } = body;
      if (!response) return jsonResp({ error: "missing response" }, 400);

      const { data: ch } = await admin
        .from("webauthn_challenges")
        .select("id, challenge")
        .eq("user_id", user.id).eq("kind", "register")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!ch) return jsonResp({ error: "no challenge" }, 400);

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return jsonResp({ error: "verify failed" }, 400);
      }
      const { credential } = verification.registrationInfo as any;
      const credId = credential.id; // base64url string in v10
      const pubKey = btoa(String.fromCharCode(...credential.publicKey));

      await admin.from("webauthn_credentials").insert({
        user_id: user.id,
        credential_id: credId,
        public_key: pubKey,
        counter: credential.counter ?? 0,
        transports: credential.transports ?? null,
        device_label: deviceLabel || null,
      });
      await admin.from("webauthn_challenges").delete().eq("id", ch.id);
      return jsonResp({ ok: true });
    }

    // -------- AUTH OPTIONS (login) --------
    if (action === "auth-options") {
      const { email } = body;
      let userId: string | null = null;
      let allowCreds: any[] = [];
      if (email) {
        const { data: prof } = await admin
          .from("profiles").select("id").eq("email", email).maybeSingle();
        if (prof) userId = prof.id;
        if (userId) {
          const { data: creds } = await admin
            .from("webauthn_credentials")
            .select("credential_id, transports").eq("user_id", userId);
          allowCreds = (creds ?? []).map((c: any) => ({ id: c.credential_id, transports: c.transports ?? undefined }));
        }
      }
      const options = await generateAuthenticationOptions({
        rpID, userVerification: "preferred",
        allowCredentials: allowCreds.length ? allowCreds : undefined,
      });
      await admin.from("webauthn_challenges").insert({
        user_id: userId, challenge: options.challenge, kind: "authenticate",
      });
      return jsonResp({ options });
    }

    // -------- AUTH VERIFY --------
    if (action === "auth-verify") {
      const { response } = body;
      if (!response?.id) return jsonResp({ error: "missing response" }, 400);

      const { data: cred } = await admin
        .from("webauthn_credentials")
        .select("user_id, credential_id, public_key, counter, transports")
        .eq("credential_id", response.id).maybeSingle();
      if (!cred) return jsonResp({ error: "unknown credential" }, 404);

      const { data: ch } = await admin
        .from("webauthn_challenges")
        .select("id, challenge")
        .or(`user_id.eq.${cred.user_id},user_id.is.null`)
        .eq("kind", "authenticate")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!ch) return jsonResp({ error: "no challenge" }, 400);

      const pubKeyBytes = Uint8Array.from(atob(cred.public_key), (c) => c.charCodeAt(0));
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: cred.credential_id,
          publicKey: pubKeyBytes,
          counter: Number(cred.counter),
          transports: cred.transports ?? undefined,
        },
      });

      if (!verification.verified) return jsonResp({ error: "verify failed" }, 401);

      await admin.from("webauthn_credentials").update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      }).eq("credential_id", cred.credential_id);
      await admin.from("webauthn_challenges").delete().eq("id", ch.id);

      // ออก magic-link เพื่อสร้าง session (passkey-only sign-in)
      const { data: u } = await admin.auth.admin.getUserById(cred.user_id);
      if (!u?.user?.email) return jsonResp({ error: "user has no email" }, 400);
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: u.user.email,
        options: { redirectTo: origin },
      });
      if (linkErr) return jsonResp({ error: linkErr.message }, 500);
      return jsonResp({ ok: true, action_link: link.properties?.action_link });
    }

    return jsonResp({ error: "unknown action" }, 400);
  } catch (e: any) {
    return jsonResp({ error: e?.message || String(e) }, 500);
  }
});
