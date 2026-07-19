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

// Reply API is FREE — does not consume push message quota.
// Each replyToken is single-use and valid ~1 minute.
async function replyMessage(token: string, replyToken: string, text: string) {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    });
    if (!res.ok) console.error("LINE reply fail", res.status, await res.text());
  } catch (e) { console.error("replyMessage", e); }
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

    // Per-group aggregation of this webhook batch so we send ONE friendly summary reply
    // instead of spamming the group with one message per photo/file.
    type GroupAgg = {
      groupId: string;
      replyToken?: string; // use the first available reply token from the batch
      photos: number;
      files: number;
      notes: number;
      videos: number;
      audios: number;
      imageSets: Set<string>;
    };
    const perGroup = new Map<string, GroupAgg>();

    for (const event of events) {
      try {
        if (event.type !== "message") continue;
        if (event.source?.type !== "group" && event.source?.type !== "room") continue;
        const result = await captureLineGroupEvent(sb, token, event, {
          downloadLineContent,
          fetchLineProfile: fetchLineGroupMemberProfile,
        });
        if (!result?.captured) continue;

        const groupId = event.source.groupId || event.source.roomId;
        if (!groupId) continue;
        let agg = perGroup.get(groupId);
        if (!agg) {
          agg = { groupId, replyToken: event.replyToken, photos: 0, files: 0, notes: 0, videos: 0, audios: 0, imageSets: new Set() };
          perGroup.set(groupId, agg);
        } else if (!agg.replyToken && event.replyToken) {
          agg.replyToken = event.replyToken;
        }

        const t = event.message?.type;
        if (t === "image") {
          const setId = event.message?.imageSet?.id;
          if (setId) agg.imageSets.add(setId);
          agg.photos++;
        } else if (t === "video") agg.videos++;
        else if (t === "audio") agg.audios++;
        else if (t === "text") agg.notes++;
        else agg.files++;
      } catch (e) {
        console.error("vault event error", e);
      }
    }

    // Send at most one reply per group, respecting per-group cooldown to avoid spam.
    for (const [groupId, agg] of perGroup) {
      if (!agg.replyToken) continue;
      const { data: grp } = await sb
        .from("line_vault_groups")
        .select("notify_on_capture, notify_cooldown_minutes, last_notified_at, group_name")
        .eq("line_group_id", groupId)
        .maybeSingle();
      if (!grp || grp.notify_on_capture === false) continue;

      const cooldownMin = Number(grp.notify_cooldown_minutes ?? 3);
      if (cooldownMin > 0 && grp.last_notified_at) {
        const last = new Date(grp.last_notified_at).getTime();
        if (Date.now() - last < cooldownMin * 60_000) continue; // stay silent this round
      }

      const parts: string[] = [];
      if (agg.photos > 0) {
        const albums = agg.imageSets.size;
        if (albums > 0 && agg.photos > albums) {
          parts.push(`🖼️ อัลบั้มรูป ${agg.photos} รูป`);
        } else {
          parts.push(`🖼️ รูปภาพ ${agg.photos} รูป`);
        }
      }
      if (agg.videos > 0) parts.push(`🎬 วิดีโอ ${agg.videos}`);
      if (agg.audios > 0) parts.push(`🎵 เสียง ${agg.audios}`);
      if (agg.files > 0) parts.push(`📎 ไฟล์ ${agg.files}`);
      if (agg.notes > 0) parts.push(`📝 โน้ต ${agg.notes}`);
      if (!parts.length) continue;

      const text = `✅ เก็บเข้าคลังแล้ว: ${parts.join(" • ")}`;
      await replyMessage(token, agg.replyToken, text);
      await sb.from("line_vault_groups")
        .update({ last_notified_at: new Date().toISOString() })
        .eq("line_group_id", groupId);
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
