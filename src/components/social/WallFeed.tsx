import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { sanitizeStorageKey } from "@/lib/uploadFallback";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Heart, ThumbsUp, MessageCircle, Image as ImageIcon, Send, Trash2, Youtube } from "lucide-react";
import { toast } from "sonner";
import { detectMediaTypeFromUrl } from "@/lib/media";
import MediaRenderer from "./MediaRenderer";

interface WallPost {
  id: string;
  author_id: string;
  content: string | null;
  media_urls: string[];
  link_url: string | null;
  link_type: string | null;
  reaction_count: number;
  comment_count: number;
  created_at: string;
  author?: { first_name?: string | null; last_name?: string | null; avatar_url?: string | null };
  my_reaction?: string | null;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: { first_name?: string | null; last_name?: string | null; avatar_url?: string | null };
}

const initials = (a?: any) =>
  `${a?.first_name?.[0] ?? ""}${a?.last_name?.[0] ?? ""}`.toUpperCase() || "?";
const fullName = (a?: any) =>
  `${a?.first_name ?? ""} ${a?.last_name ?? ""}`.trim() || "ผู้ใช้";

export default function WallFeed({ profileUserId }: { profileUserId?: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const { isAdmin: _rawA, isDirector: _rawD } = useUserRole(); const isAdmin = _rawA || _rawD;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Resolve a media value to a usable URL. If it already looks like a URL/data/blob,
  // pass through (compat for legacy rows with stored signed URLs); otherwise sign the storage path.
  const resolveMediaUrl = async (val: string): Promise<string> => {
    if (!val) return val;
    if (/^(https?:|data:|blob:)/.test(val)) return val;
    const { data } = await supabase.storage.from("wall-media").createSignedUrl(val, 60 * 60); // 1h
    return data?.signedUrl || val;
  };

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("wall_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (profileUserId) q = q.eq("author_id", profileUserId);
    const { data: rows } = await q;
    const list = await Promise.all(
      (rows || []).map(async (p: any) => ({
        ...p,
        media_urls: await Promise.all((p.media_urls || []).map(resolveMediaUrl)),
      }))
    ) as WallPost[];

    // fetch authors via public profile rpc
    const ids = Array.from(new Set(list.map((p) => p.author_id)));
    const authors = new Map<string, any>();
    await Promise.all(
      ids.map(async (id) => {
        const { data } = await supabase.rpc("get_public_profile", { _id: id });
        const row = Array.isArray(data) ? data[0] : data;
        if (row) authors.set(id, row);
      })
    );

    // my reactions
    let myReactions = new Map<string, string>();
    if (userId && list.length) {
      const { data: rxs } = await supabase
        .from("wall_post_reactions")
        .select("post_id, reaction_type")
        .eq("user_id", userId)
        .in("post_id", list.map((p) => p.id));
      (rxs || []).forEach((r: any) => myReactions.set(r.post_id, r.reaction_type));
    }

    setPosts(list.map((p) => ({ ...p, author: authors.get(p.author_id), my_reaction: myReactions.get(p.id) ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("wall_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "wall_posts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "wall_post_reactions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "wall_post_comments" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profileUserId]);

  const submit = async () => {
    if (!userId) return toast.error("กรุณาเข้าสู่ระบบ");
    if (!content.trim() && !linkUrl.trim()) return toast.error("เพิ่มข้อความหรือลิงก์");
    setPosting(true);
    const link_type = linkUrl ? detectMediaTypeFromUrl(linkUrl) : null;
    const { error } = await supabase.from("wall_posts").insert({
      author_id: userId,
      content: content.trim() || null,
      link_url: linkUrl.trim() || null,
      link_type,
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    setContent("");
    setLinkUrl("");
    toast.success("โพสต์เรียบร้อย");
  };

  const uploadImage = async (file: File) => {
    if (!userId) return;
    const path = sanitizeStorageKey(`${userId}/${Date.now()}-${file.name}`);
    const { error: upErr } = await supabase.storage.from("wall-media").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    // Store the storage path (not a signed URL) so we can re-sign on read and avoid 365-day expiry.
    const { error: insErr } = await supabase.from("wall_posts").insert({
      author_id: userId,
      content: content.trim() || null,
      media_urls: [path],
    });
    if (insErr) return toast.error(insErr.message);
    setContent("");
    toast.success("อัปโหลดรูปภาพแล้ว");
  };

  const react = async (post: WallPost, type: string) => {
    if (!userId) return toast.error("กรุณาเข้าสู่ระบบ");
    const wasType = post.my_reaction;
    const removing = wasType === type;
    // Optimistic UI
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              my_reaction: removing ? null : type,
              reaction_count: Math.max(0, (p.reaction_count || 0) + (removing ? -1 : wasType ? 0 : 1)),
            }
          : p
      )
    );
    if (removing) {
      const { error } = await supabase
        .from("wall_post_reactions")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", userId);
      if (error) { toast.error(error.message); load(); }
    } else {
      const { error } = await supabase
        .from("wall_post_reactions")
        .upsert({ post_id: post.id, user_id: userId, reaction_type: type }, { onConflict: "post_id,user_id" });
      if (error) { toast.error(error.message); load(); }
    }
  };

  const removePost = async (id: string) => {
    if (!confirm("ลบโพสต์นี้?")) return;
    const { error } = await supabase.from("wall_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ลบโพสต์แล้ว");
  };

  return (
    <div className="space-y-4">
      {/* Composer */}
      {userId && !profileUserId && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Textarea
              placeholder="แบ่งปันกิจกรรม ผลงาน หรือข้อความถึงทุกคนในโรงเรียน..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="แนบลิงก์ YouTube / Drive / เว็บไซต์ (ไม่บังคับ)"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                />
                <Button asChild size="sm" variant="outline">
                  <span><ImageIcon className="w-4 h-4 mr-1" />รูป/วิดีโอ</span>
                </Button>
              </label>
              <Button size="sm" onClick={submit} disabled={posting}>
                <Send className="w-4 h-4 mr-1" />โพสต์
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && <div className="text-center text-muted-foreground py-8">กำลังโหลด...</div>}

      {!loading && posts.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">ยังไม่มีโพสต์</CardContent></Card>
      )}

      {posts.map((p) => (
        <Card key={p.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Link to={`/p/${p.author_id}`}>
                <Avatar className="w-10 h-10">
                  <AvatarImage src={p.author?.avatar_url ?? undefined} />
                  <AvatarFallback>{initials(p.author)}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/p/${p.author_id}`} className="font-semibold text-sm hover:underline">
                  {fullName(p.author)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString("th-TH")}
                </p>
              </div>
              {(p.author_id === userId || isAdmin) && (
                <Button size="icon" variant="ghost" onClick={() => removePost(p.id)} title={isAdmin && p.author_id !== userId ? "ลบ (แอดมิน)" : "ลบโพสต์"}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>

            {p.content && <p className="whitespace-pre-wrap text-sm">{p.content}</p>}

            {p.media_urls?.map((url, i) => (
              <MediaRenderer key={i} mediaType={detectMediaTypeFromUrl(url)} mediaUrl={url} />
            ))}

            {p.link_url && (
              <MediaRenderer
                mediaType={(p.link_type as any) || detectMediaTypeFromUrl(p.link_url)}
                mediaUrl={p.link_url}
              />
            )}

            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant={p.my_reaction === "like" ? "default" : "ghost"}
                onClick={() => react(p, "like")}
              >
                <ThumbsUp className="w-4 h-4 mr-1" />ถูกใจ
              </Button>
              <Button
                size="sm"
                variant={p.my_reaction === "heart" ? "default" : "ghost"}
                onClick={() => react(p, "heart")}
              >
                <Heart className="w-4 h-4 mr-1" />หัวใจ
              </Button>
              <div className="text-xs text-muted-foreground ml-auto">
                {p.reaction_count} ถูกใจ • {p.comment_count} ความคิดเห็น
              </div>
            </div>

            <CommentSection postId={p.id} userId={userId} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CommentSection({ postId, userId }: { postId: string; userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("wall_post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at");
    const list = (data || []) as Comment[];
    const ids = Array.from(new Set(list.map((c) => c.user_id)));
    const authors = new Map<string, any>();
    await Promise.all(
      ids.map(async (id) => {
        const { data } = await supabase.rpc("get_public_profile", { _id: id });
        const row = Array.isArray(data) ? data[0] : data;
        if (row) authors.set(id, row);
      })
    );
    setComments(list.map((c) => ({ ...c, author: authors.get(c.user_id) })));
  };

  useEffect(() => {
    if (!open) return;
    load();
    const ch = supabase
      .channel(`comments-${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wall_post_comments", filter: `post_id=eq.${postId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line
  }, [open, postId]);

  const submit = async () => {
    if (!userId || !text.trim()) return;
    const { error } = await supabase
      .from("wall_post_comments")
      .insert({ post_id: postId, user_id: userId, content: text.trim() });
    if (error) return toast.error(error.message);
    setText("");
  };

  return (
    <div>
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
        <MessageCircle className="w-4 h-4 mr-1" />
        {open ? "ซ่อนความคิดเห็น" : "แสดงความคิดเห็น"}
      </Button>
      {open && (
        <div className="mt-2 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 items-start text-sm">
              <Avatar className="w-7 h-7">
                <AvatarImage src={c.author?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">{initials(c.author)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 bg-muted/40 rounded-lg px-3 py-2">
                <p className="font-medium text-xs">{fullName(c.author)}</p>
                <p className="whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
          {userId && (
            <div className="flex gap-2">
              <Input
                placeholder="เขียนความคิดเห็น..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
              />
              <Button size="sm" onClick={submit}><Send className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
