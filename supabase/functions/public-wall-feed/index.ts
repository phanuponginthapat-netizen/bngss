import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async req => {
  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });
  try {
    const sb = makeAdmin();
    const { data, error } = await sb.from("wall_posts").select("id,author_id,content,media_urls,link_url,link_type,created_at").eq("visibility", "public").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    const posts = await Promise.all((data ?? []).map(async post => {
      const media_urls = await Promise.all((post.media_urls ?? []).map(async (value: string) => {
        let path = value;
        if (/^https?:/i.test(value)) {
          const url = new URL(value);
          if (url.origin !== new URL(Deno.env.get("SUPABASE_URL") ?? "").origin) return value;
          const match = url.pathname.match(/^\/storage\/v1\/object\/(?:sign|public|authenticated)\/wall-media\/(.+)$/);
          if (!match) return value;
          path = decodeURIComponent(match[1]);
        }
        const { data: signed, error } = await sb.storage.from("wall-media").createSignedUrl(path, 3600);
        if (error || !signed?.signedUrl) throw new Error("Media unavailable");
        return signed.signedUrl;
      }));
      const { data: profile, error } = await sb.rpc("get_public_profile", { _id: post.author_id });
      if (error) throw error;
      const author = Array.isArray(profile) ? profile[0] : profile;
      return { ...post, media_urls, author: author ? { first_name: author.first_name, last_name: author.last_name, avatar_url: author.avatar_url } : null };
    }));
    return new Response(JSON.stringify({ posts }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: "โหลดประชาสัมพันธ์ไม่สำเร็จ" }), { status: 500, headers });
  }
});