// Fetches latest posts from a Facebook Page via Graph API,
// upserts into public.social_posts, and broadcasts new ones to LINE OA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSecret } from "../_shared/getSecret.ts";
import { secretKeys } from "../_shared/secretKeys.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";

import { corsHeadersWithCron as corsHeaders } from "../_shared/cors.ts";

const GRAPH_VERSION = "v21.0";

async function getSetting(admin: any, key: string): Promise<string | null> {
  const { data } = await admin.from("school_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  return data?.setting_value ?? null;
}

async function fetchFacebookPosts(pageId: string, token: string, limit = 10) {
  const fields = [
    "id",
    "message",
    "created_time",
    "permalink_url",
    "full_picture",
    "attachments{media_type,media,subattachments,url,title,description}",
  ].join(",");
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}/posts?limit=${limit}&fields=${fields}&access_token=${encodeURIComponent(token)}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(`Facebook Graph error ${r.status}: ${JSON.stringify(j)}`);
  return Array.isArray(j.data) ? j.data : [];
}

function extractMedia(post: any): { thumb: string | null; media: string[] } {
  const out: string[] = [];
  let thumb: string | null = post.full_picture || null;
  const subs = post?.attachments?.data || [];
  for (const a of subs) {
    if (a?.media?.image?.src) out.push(a.media.image.src);
    for (const s of a?.subattachments?.data || []) {
      if (s?.media?.image?.src) out.push(s.media.image.src);
    }
  }
  if (!thumb && out.length) thumb = out[0];
  return { thumb, media: Array.from(new Set(out)) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const token = (await getSecret(secretKeys.fbPageAccessToken)) || (await getSetting(admin, "fb_page_access_token"));
    const pageId = (await getSetting(admin, "fb_page_id")) || (await getSecret(secretKeys.fbPageId));

    if (!token || !pageId) {
      return new Response(
        JSON.stringify({ error: "Missing Facebook page connection or page ID setting" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const broadcast: boolean = body.broadcast !== false; // default true
    const limit: number = Math.min(Number(body.limit ?? 10), 25);

    const posts = await fetchFacebookPosts(pageId, token, limit);

    let inserted = 0;
    const newOnes: any[] = [];

    for (const p of posts) {
      const { thumb, media } = extractMedia(p);
      const payload = {
        platform: "facebook",
        external_id: p.id,
        page_id: pageId,
        content: p.message ?? null,
        media_urls: media,
        thumbnail_url: thumb,
        permalink: p.permalink_url ?? null,
        posted_at: p.created_time ?? null,
        raw: p,
      };

      // Check if exists first to know if it's new
      const { data: existing } = await admin
        .from("social_posts")
        .select("id")
        .eq("platform", "facebook")
        .eq("external_id", p.id)
        .maybeSingle();

      const { error } = await admin
        .from("social_posts")
        .upsert(payload, { onConflict: "platform,external_id" });

      if (!error && !existing) {
        inserted++;
        newOnes.push(payload);
      }
    }

    // Broadcast newly inserted posts to LINE
    let broadcasted = 0;
    if (broadcast && newOnes.length > 0) {
      for (const np of newOnes) {
        try {
          const title = "📢 ข่าวสารใหม่จากเพจโรงเรียน";
          const msg = (np.content || "(ดูรายละเอียดบนเพจ)").slice(0, 500);
          const r = await fetch(`${SUPABASE_URL}/functions/v1/notify-line`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({
              title,
              message: msg,
              action_url: np.permalink,
              action_label: "ดูโพสต์ต้นฉบับ",
              use_flex: true,
              severity: "info",
              broadcast: true,
              notification_type: "social_feed",
            }),
          });
          const stamp = new Date().toISOString();
          if (r.ok) {
            broadcasted++;
            await admin.from("social_posts").update({ broadcasted_at: stamp }).eq("external_id", np.external_id).eq("platform", "facebook");
          } else {
            const errText = await r.text();
            await admin.from("social_posts").update({ broadcast_error: errText.slice(0, 500) }).eq("external_id", np.external_id).eq("platform", "facebook");
          }
        } catch (e) {
          console.error("LINE broadcast failed:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, fetched: posts.length, inserted, broadcasted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("social-feed-sync error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
