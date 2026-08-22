import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeadersPost as corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // SECURITY: require authenticated admin caller, OR a valid BOOTSTRAP_SECRET when no admin exists
    const { count: adminCount } = await admin
      .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const bootstrapSecret = Deno.env.get("BOOTSTRAP_SECRET");
    const provided = req.headers.get("x-bootstrap-secret") || "";
    const bootstrapAllowed = (adminCount ?? 0) === 0 && bootstrapSecret && provided === bootstrapSecret;

    if (!bootstrapAllowed) {
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: userData } = await admin.auth.getUser(token);
      const callerId = userData?.user?.id;
      if (!callerId) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: callerRole } = await admin.from("user_roles")
        .select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
      if (!callerRole) {
        return new Response(JSON.stringify({ success: false, error: "Forbidden: admin only" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    let body: { email?: string; password?: string; first_name?: string; last_name?: string } = {};
    try { body = await req.json(); } catch {}

    const { getAdminEmail } = await import("../_shared/appConfig.ts");
    const email = (body.email || (await getAdminEmail())).trim().toLowerCase();
    if (!body.password) {
      return new Response(JSON.stringify({ success: false, error: "password is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const password = body.password;
    const first_name = body.first_name || "ผู้ดูแล";
    const last_name = body.last_name || "ระบบ";

    // Check if user already exists
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existingUser = existing?.users?.find((u) => u.email?.toLowerCase() === email);

    let userId: string;
    let created = false;

    if (existingUser) {
      userId = existingUser.id;
      // Reset password + confirm email
      await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });
      if (error || !data.user) throw error ?? new Error("createUser failed");
      userId = data.user.id;
      created = true;
    }

    // Ensure profile
    await admin.from("profiles").upsert(
      { id: userId, first_name, last_name, is_approved: true },
      { onConflict: "id" }
    );

    // Ensure single 'admin' role
    await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role: "admin" });
    if (roleErr) throw roleErr;

    return new Response(
      JSON.stringify({
        success: true,
        created,
        user: { id: userId, email, role: "admin" },
        message: created ? "สร้าง admin สำเร็จ" : "อัปเดตรหัสผ่าน admin แล้ว",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("create-admin-user error", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});