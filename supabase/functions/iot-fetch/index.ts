import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";

function getByPath(obj: any, path: string | null | undefined): any {
  if (!path) return obj;
  // supports $.a.b.c or a.b.c
  const cleaned = path.replace(/^\$\.?/, "");
  if (!cleaned) return obj;
  return cleaned.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

async function fetchDeviceValue(device: any): Promise<{ value: string | null; numeric: number | null; status: string; error?: string; raw?: any; }> {
  try {
    let url = "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (device.source_type === "home_assistant") {
      if (!device.base_url || !device.entity_id) {
        return { value: null, numeric: null, status: "error", error: "missing base_url or entity_id" };
      }
      url = `${device.base_url.replace(/\/$/, "")}/api/states/${device.entity_id}`;
      if (device.api_token) headers["Authorization"] = `Bearer ${device.api_token}`;
    } else if (device.source_type === "generic_rest") {
      if (!device.base_url) {
        return { value: null, numeric: null, status: "error", error: "missing base_url" };
      }
      url = `${device.base_url.replace(/\/$/, "")}${device.request_path || ""}`;
      if (device.api_token) headers["Authorization"] = `Bearer ${device.api_token}`;
    } else {
      return { value: null, numeric: null, status: "error", error: `unsupported source_type ${device.source_type}` };
    }

    const resp = await fetch(url, { headers, method: "GET" });
    if (!resp.ok) {
      const txt = await resp.text();
      return { value: null, numeric: null, status: "error", error: `HTTP ${resp.status}: ${txt.slice(0, 200)}` };
    }
    const json = await resp.json().catch(async () => ({ raw: await resp.text() }));
    let extracted: any;
    if (device.source_type === "home_assistant") {
      extracted = device.json_path ? getByPath(json, device.json_path) : json.state;
    } else {
      extracted = device.json_path ? getByPath(json, device.json_path) : json;
    }
    const valueStr = extracted == null ? null : (typeof extracted === "object" ? JSON.stringify(extracted) : String(extracted));
    const num = valueStr != null && !isNaN(Number(valueStr)) ? Number(valueStr) : null;
    return { value: valueStr, numeric: num, status: "online", raw: json };
  } catch (e) {
    return { value: null, numeric: null, status: "error", error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = makeAdmin();

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const deviceId: string | undefined = body.device_id;
    const recordHistory: boolean = body.record_history !== false;

    let query = admin.from("iot_devices").select("*").eq("is_active", true);
    if (deviceId) query = query.eq("id", deviceId);
    const { data: devices, error: dErr } = await query;
    if (dErr) throw dErr;

    const results: any[] = [];
    for (const dev of devices ?? []) {
      const r = await fetchDeviceValue(dev);
      const now = new Date().toISOString();
      await admin.from("iot_devices").update({
        last_value: r.value,
        last_value_numeric: r.numeric,
        last_status: r.status,
        last_error: r.error ?? null,
        last_fetched_at: now,
      }).eq("id", dev.id);

      if (recordHistory && r.status === "online") {
        await admin.from("iot_readings").insert({
          device_id: dev.id,
          value: r.value,
          value_numeric: r.numeric,
          status: r.status,
          recorded_at: now,
        });
      }
      results.push({ device_id: dev.id, name: dev.name, ...r });
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("iot-fetch error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});