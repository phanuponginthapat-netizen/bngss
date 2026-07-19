// Dedicated LINE OA webhook for LINE Vault (group/room capture only).
// Uses its own channel access token: LINE_VAULT_CHANNEL_ACCESS_TOKEN
// so it is fully independent from the chatbot OA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { captureLineGroupEvent, fetchLineGroupMemberProfile } from "../_shared/lineVaultCapture.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-line-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function downloadLineContent(token: string, messageId: string) {
  try {
    const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { console.error("LINE content fetch fail", res.status); return null; }
    const mime = res.headers.get("content-type") || "application/octet-stream";
    const buf = new Uint8Array(await res.arrayBuffer());
    return { data: buf, mime };
  } catch (e) { console.error("downloadLineContent", e); return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("LINE_VAULT_CHANNEL_ACCESS_TOKEN");

    const body = await req.json().catch(() => ({}));

    // Health-check ping from admin UI
    if (body?.__ping) {
      return new Response(JSON.stringify({ ok: true, token_configured: !!token }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!token) {
      console.error("LINE_VAULT_CHANNEL_ACCESS_TOKEN not set");
      return new Response(JSON.stringify({ error: "LINE Vault OA token not configured", token_configured: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const events: any[] = body?.events || [];

    for (const event of events) {
      try {
        if (event.type !== "message") continue;
        if (event.source?.type !== "group" && event.source?.type !== "room") continue;
        await captureLineGroupEvent(sb, token, event, {
          downloadLineContent,
          fetchLineProfile: fetchLineGroupMemberProfile,
        });
      } catch (e) {
        console.error("vault event error", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: events.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("line-vault-webhook fatal", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
