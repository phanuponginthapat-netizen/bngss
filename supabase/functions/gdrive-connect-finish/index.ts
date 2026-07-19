// Landing page after gateway OAuth completes.
// Gateway redirects here with connection_key (and/or a token) as query params.
// This function stores the connection_key and redirects the user back to /my-drive.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GATEWAY = "https://connector-gateway.lovable.dev";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const connectionKey = url.searchParams.get("connection_key")
    ?? url.searchParams.get("app_user_connection_key")
    ?? url.searchParams.get("credential_key");
  const externalUserId = url.searchParams.get("external_user_id")
    ?? url.searchParams.get("app_user_id")
    ?? url.searchParams.get("user_id")
    ?? "";
  const errorParam = url.searchParams.get("error");
  const returnTo = url.searchParams.get("return_to") ?? "/my-drive";

  const appOrigin = req.headers.get("origin") ?? Deno.env.get("APP_URL") ?? "https://bngss.lovable.app";
  const back = (msg: string) => {
    const u = new URL(returnTo.startsWith("http") ? returnTo : `${appOrigin}${returnTo}`);
    u.searchParams.set("drive_status", msg);
    return Response.redirect(u.toString(), 302);
  };

  if (errorParam) return back(`error:${errorParam}`);
  if (!connectionKey) return back("error:no_key");
  if (!externalUserId) return back("error:no_user");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch identity info from Google via gateway so we can display email
  let email: string | null = null;
  let name: string | null = null;
  try {
    const meRes = await fetch(`${GATEWAY}/google_drive/oauth2/v2/userinfo`, {
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": connectionKey,
      },
    });
    if (meRes.ok) {
      const j = await meRes.json();
      email = j.email ?? null;
      name = j.name ?? null;
    }
  } catch (_) { /* non-fatal */ }

  const { error } = await admin.from("app_user_connections").upsert({
    user_id: externalUserId,
    connector_id: "google_drive",
    connection_key: connectionKey,
    external_user_id: externalUserId,
    account_email: email,
    account_name: name,
    connected_at: new Date().toISOString(),
    revoked_at: null,
  }, { onConflict: "user_id,connector_id" });

  if (error) {
    console.error("db upsert failed", error);
    return back(`error:${error.code ?? "db"}`);
  }
  return back("connected");
});
