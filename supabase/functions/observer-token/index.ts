// Manages time-limited observer tokens (replaces shared account).
// Actions: create, verify, revoke
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeadersPost } from "../_shared/cors.ts";

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersPost });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...corsHeadersPost, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action, observer_name, token, note, expires_hours } = body;

    if (!action || !["create", "verify", "revoke"].includes(action)) {
      return new Response(JSON.stringify({ error: "invalid_action" }), {
        status: 400,
        headers: { ...corsHeadersPost, "Content-Type": "application/json" },
      });
    }

    const admin = makeAdmin();

    // ── create ──────────────────────────────────────────────────────────
    if (action === "create") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      const jwt = authHeader.slice(7);
      const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "admin") {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      if (!observer_name || typeof observer_name !== "string") {
        return new Response(JSON.stringify({ error: "observer_name_required" }), {
          status: 400,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      const hours = typeof expires_hours === "number" && expires_hours > 0 ? expires_hours : 24;
      const newToken = generateToken();
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

      const { error: insertErr } = await admin.from("observer_tokens").insert({
        token: newToken,
        observer_name: observer_name.trim(),
        note: note || null,
        expires_at: expiresAt,
        created_by: user.id,
        is_active: true,
        use_count: 0,
        max_uses: 1000,
      });

      if (insertErr) {
        return new Response(JSON.stringify({ error: "insert_failed", detail: insertErr.message }), {
          status: 500,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ token: newToken, expires_at: expiresAt, observer_name: observer_name.trim() }),
        { status: 200, headers: { ...corsHeadersPost, "Content-Type": "application/json" } },
      );
    }

    // ── verify ──────────────────────────────────────────────────────────
    if (action === "verify") {
      if (!token || typeof token !== "string") {
        return new Response(JSON.stringify({ error: "token_required" }), {
          status: 400,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      const { data: row, error: selErr } = await admin
        .from("observer_tokens")
        .select("id, observer_name, is_active, expires_at, use_count, max_uses")
        .eq("token", token)
        .maybeSingle();

      if (selErr || !row) {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      if (!row.is_active || new Date(row.expires_at) <= new Date() || row.use_count >= row.max_uses) {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      const { error: updErr } = await admin
        .from("observer_tokens")
        .update({ use_count: row.use_count + 1 })
        .eq("id", row.id);

      if (updErr) {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ valid: true, observer_name: row.observer_name }),
        { status: 200, headers: { ...corsHeadersPost, "Content-Type": "application/json" } },
      );
    }

    // ── revoke ──────────────────────────────────────────────────────────
    if (action === "revoke") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      const jwt = authHeader.slice(7);
      const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "admin") {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      if (!token || typeof token !== "string") {
        return new Response(JSON.stringify({ error: "token_required" }), {
          status: 400,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      const { error: updErr } = await admin
        .from("observer_tokens")
        .update({ is_active: false })
        .eq("token", token);

      if (updErr) {
        return new Response(JSON.stringify({ error: "revoke_failed", detail: updErr.message }), {
          status: 500,
          headers: { ...corsHeadersPost, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeadersPost, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: "internal", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeadersPost, "Content-Type": "application/json" },
    });
  }
});
