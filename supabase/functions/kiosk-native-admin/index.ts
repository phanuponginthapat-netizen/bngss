import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { authorizeCaller, ADMIN_ROLES } from "../_shared/callerAuth.ts";
import { authorizeKioskFace } from "../_shared/kioskFaceAuth.ts";

// Native management remains a Cloud client, never an independent school database.
Deno.serve(async (req) => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    if (body.action !== "roster") return json({ error: "invalid_action" }, 400);
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "configuration_unavailable" }, 503);
    const db = createClient(url, key);
    if (req.headers.has("x-device-key")) {
      if (!(await authorizeKioskFace(req, db))) return json({ error: "unauthorized_device" }, 401);
    } else {
      const caller = await authorizeCaller(req, corsHeaders, { roles: ADMIN_ROLES, allowService: false });
      if (caller instanceof Response) return caller;
    }
    const students = [];
    for (let from = 0; from < 100000; from += 500) {
      const { data, error } = await db.from("students")
        .select("id,student_code,prefix,first_name,last_name,classrooms!students_classroom_id_fkey(name)")
        .eq("status", "active").order("id").range(from, from + 499);
      if (error || !data) throw error ?? new Error("source unavailable");
      students.push(...data.map(s => ({ id: s.id, student_code: s.student_code,
        full_name: `${s.prefix ?? ""}${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
        class_room: (s.classrooms as unknown as { name?: string } | null)?.name ?? "" })));
      if (data.length < 500) return json({ students });
    }
    return json({ error: "roster_too_large" }, 503);
  } catch { return json({ error: "roster_unavailable" }, 503); }
});