import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Require admin caller
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ success: false, error: "Unauthorized" }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (!callerId) return json({ success: false, error: "Unauthorized" }, 401);
    const { data: callerRole } = await admin.from("user_roles")
      .select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!callerRole) return json({ success: false, error: "Forbidden: admin only" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const action = (body.action || "list") as "list" | "create" | "delete";

    if (action === "list") {
      const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "observer");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) return json({ success: true, observers: [] });
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const observers = (users?.users || [])
        .filter((u) => ids.includes(u.id))
        .map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }));
      return json({ success: true, observers });
    }

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const display_name = String(body.display_name || "ผู้สังเกตการณ์");
      if (!email || password.length < 6) return json({ success: false, error: "email/password required (min 6)" }, 400);

      const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = existing?.users?.find((u) => u.email?.toLowerCase() === email);
      let userId: string;
      if (found) {
        userId = found.id;
        await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { first_name: display_name, last_name: "" },
        });
        if (error || !data.user) throw error ?? new Error("createUser failed");
        userId = data.user.id;
      }

      await admin.from("profiles").upsert(
        { id: userId, first_name: display_name, last_name: "", is_approved: true },
        { onConflict: "id" }
      );
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: "observer" });

      return json({ success: true, user: { id: userId, email } });
    }

    if (action === "delete") {
      const user_id = String(body.user_id || "");
      if (!user_id) return json({ success: false, error: "user_id required" }, 400);
      // Only allow deleting users whose role is observer
      const { data: r } = await admin.from("user_roles").select("role").eq("user_id", user_id).maybeSingle();
      if (!r || r.role !== "observer") return json({ success: false, error: "Not an observer" }, 400);
      await admin.from("user_roles").delete().eq("user_id", user_id);
      await admin.from("profiles").delete().eq("id", user_id);
      await admin.auth.admin.deleteUser(user_id);
      return json({ success: true });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (e) {
    console.error("manage-observers error", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
