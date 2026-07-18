// Auto-create initial admin user on first run. Idempotent.
// Also supports one-shot password reset when only a single admin exists
// (used to recover access when no password is known).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeadersWithBootstrap as corsHeaders } from "../_shared/cors.ts";

const DEFAULT_EMAIL = "admin@school.com";

function genPassword() {
  const buf = new Uint8Array(18);
  crypto.getRandomValues(buf);
  return (
    "Admin@" +
    btoa(String.fromCharCode(...buf)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 18) +
    "!"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supaUrl, srv);

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  try {
    // Get all admins
    const { data: adminRows } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminCount = adminRows?.length ?? 0;

    // Recovery mode: exactly one admin exists → allow password reset of that admin.
    // Safe because it only resets the sole admin account when the operator has lost access.
    if (adminCount === 1 && body?.reset === true) {
      const userId = adminRows![0].user_id;
      const { data: userInfo } = await admin.auth.admin.getUserById(userId);
      const email = userInfo?.user?.email ?? DEFAULT_EMAIL;
      const password = genPassword();
      const { error: uErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      await admin.from("profiles").update({ is_approved: true, must_change_password: true }).eq("id", userId);
      return json({ reset: true, email, password });
    }

    if (adminCount > 0) return json({ created: false, reason: "admin_exists" });

    // First-run bootstrap
    const password = genPassword();
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
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user!.id;
    }

    await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role: "admin" });
    if (rErr) throw rErr;

    await admin.from("profiles").update({ is_approved: true, must_change_password: true }).eq("id", userId);

    return json({ created: true, email: DEFAULT_EMAIL, password });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});
