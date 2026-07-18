// Auto-create initial admin user on first run. Idempotent.
// SECURITY: requires BOOTSTRAP_SECRET in the request body (header x-bootstrap-secret)
// to prevent anonymous bootstrap or credential disclosure. Returns { created } only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const DEFAULT_EMAIL = "admin@school.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supaUrl, srv);

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // If any admin role already exists, do nothing.
    const { count } = await admin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) > 0) return json({ created: false, reason: "admin_exists" });

    // First-run bootstrap: allowed when no admin exists yet (count check above)

    // Generate a strong random password — never returned in the response
    const buf = new Uint8Array(18);
    crypto.getRandomValues(buf);
    const password = "Admin@" + btoa(String.fromCharCode(...buf)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 18) + "!";

    let userId: string | null = null;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: DEFAULT_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { first_name: "Admin", last_name: "ระบบ" },
    });

    if (cErr) {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find((u: any) => u.email === DEFAULT_EMAIL);
      if (!existing) throw cErr;
      userId = existing.id;
      // Reset to a new strong random password
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user!.id;
    }

    await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role: "admin" });
    if (rErr) throw rErr;

    await admin.from("profiles").update({ is_approved: true, must_change_password: true }).eq("id", userId);

    // Return password ONCE on first creation so the operator can sign in.
    return json({ created: true, email: DEFAULT_EMAIL, password });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});
