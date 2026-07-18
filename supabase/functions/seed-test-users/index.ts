import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeadersPost as corsHeaders } from "../_shared/cors.ts";

type Role = "director" | "teacher" | "student" | "alumni";

const TEST_USERS: Array<{ email: string; role: Role; first_name: string; last_name: string }> = [
  { email: "director@test.school", role: "director", first_name: "ทดสอบ", last_name: "ผู้อำนวยการ" },
  { email: "teacher@test.school", role: "teacher", first_name: "ทดสอบ", last_name: "ครู" },
  { email: "student@test.school", role: "student", first_name: "ทดสอบ", last_name: "นักเรียน" },
  { email: "alumni@test.school", role: "alumni", first_name: "ทดสอบ", last_name: "ศิษย์เก่า" },
];

const PASSWORD = "Test@1234";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // SECURITY: admin only
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
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

    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const results: any[] = [];

    for (const u of TEST_USERS) {
      const found = existing?.users?.find((x) => x.email?.toLowerCase() === u.email);
      let userId: string;
      let created = false;

      if (found) {
        userId = found.id;
        await admin.auth.admin.updateUserById(userId, {
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { first_name: u.first_name, last_name: u.last_name },
        });
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: u.email,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { first_name: u.first_name, last_name: u.last_name },
        });
        if (error || !data.user) {
          results.push({ email: u.email, error: error?.message ?? "createUser failed" });
          continue;
        }
        userId = data.user.id;
        created = true;
      }

      // Profile
      await admin.from("profiles").upsert(
        { id: userId, first_name: u.first_name, last_name: u.last_name, is_approved: true, pdpa_accepted_at: new Date().toISOString() },
        { onConflict: "id" }
      );

      // Single role
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: u.role });

      results.push({ email: u.email, password: PASSWORD, role: u.role, created, user_id: userId });
    }

    return new Response(
      JSON.stringify({ success: true, users: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("seed-test-users error", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});