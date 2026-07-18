import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { confirmDelete } from "@/lib/confirmAction";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeStorageKey } from "@/lib/uploadFallback";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Heart, ThumbsUp, MessageCircle, Image as ImageIcon, Send, Trash2, Youtube, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { detectMediaTypeFromUrl } from "@/lib/media";
import MediaRenderer from "./MediaRenderer";
import { checkProfanity, moderateImage, fileToDataUrl } from "@/lib/contentModeration";

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
  like_count?: number;
  heart_count?: number;
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
  const { user, isReady } = useAuthSession();
  const userId = user?.id ?? null;
  const { isAdmin, isDirector, isTeacher } = useUserRole();
  const canModerate = isAdmin || isDirector || isTeacher;
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ path: string; previewUrl: string; kind: "image" | "video" }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);

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

    // my reactions + per-type counts
    let myReactions = new Map<string, string>();
    const likeCounts = new Map<string, number>();
    const heartCounts = new Map<string, number>();
    if (list.length) {
      const { data: allRxs } = await supabase
        .from("wall_post_reactions")
        .select("post_id, reaction_type, user_id")
        .in("post_id", list.map((p) => p.id));
      (allRxs || []).forEach((r: any) => {
        if (r.reaction_type === "heart") heartCounts.set(r.post_id, (heartCounts.get(r.post_id) || 0) + 1);
        else likeCounts.set(r.post_id, (likeCounts.get(r.post_id) || 0) + 1);
        if (userId && r.user_id === userId) myReactions.set(r.post_id, r.reaction_type);
      });
    }

    setPosts(list.map((p) => ({
      ...p,
      author: authors.get(p.author_id),
      my_reaction: myReactions.get(p.id) ?? null,
      like_count: likeCounts.get(p.id) || 0,
      heart_count: heartCounts.get(p.id) || 0,
    })));
    setLoading(false);
  };

  const refreshFeed = async () => {
    setNewPostCount(0);
    await load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("wall_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wall_posts" },
        (payload) => {
          const row: any = payload.new;
          if (profileUserId && row?.author_id !== profileUserId) return;
          // Own posts already inserted optimistically/loaded — don't count them
          if (row?.author_id === userId) return;
          setNewPostCount((c) => c + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wall_posts" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "wall_posts" },
        (payload) => {
          const id = (payload.old as any)?.id;
          if (id) setPosts((prev) => prev.filter((p) => p.id !== id));
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "wall_post_reactions" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profileUserId]);

  const submit = async () => {
    if (!userId) return toast.error("กรุณาเข้าสู่ระบบ");
    if (!content.trim() && !linkUrl.trim() && pendingMedia.length === 0)
      return toast.error("เพิ่มข้อความ ลิงก์ หรือรูป/วิดีโอ");
    const chk = checkProfanity(`${content} ${linkUrl}`);
    if (!chk.ok) return toast.error(`ไม่สามารถโพสต์ได้ — ${chk.reason}`);
    setPosting(true);
    const link_type = linkUrl ? detectMediaTypeFromUrl(linkUrl) : null;
    const { error } = await supabase.from("wall_posts").insert({
      author_id: userId,
      content: content.trim() || null,
      link_url: linkUrl.trim() || null,
      link_type,
      media_urls: pendingMedia.map((m) => m.path),
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    pendingMedia.forEach((m) => URL.revokeObjectURL(m.previewUrl));
    setPendingMedia([]);
    setContent("");
    setLinkUrl("");
    toast.success("โพสต์เรียบร้อย");
    load();
  };

  const stageMedia = async (file: File) => {
    if (!userId) return;
    // ตรวจรูปภาพไม่เหมาะสมก่อนอัปโหลด (เฉพาะรูปภาพ ไม่ตรวจวิดีโอ)
    if (file.type.startsWith("image/")) {
      toast.info("กำลังตรวจสอบรูปภาพ...");
      try {
        const dataUrl = await fileToDataUrl(file);
        const mod = await moderateImage(dataUrl);
        if (!mod.ok) return toast.error(`รูปภาพไม่ผ่านการตรวจสอบ — ${mod.reason}`);
      } catch (e) {
        console.warn("image moderation failed", e);
      }
    }
    setUploading(true);
    const path = sanitizeStorageKey(`${userId}/${Date.now()}-${file.name}`);
    const { error: upErr } = await supabase.storage.from("wall-media").upload(path, file);
    setUploading(false);
    if (upErr) return toast.error(upErr.message);
    const previewUrl = URL.createObjectURL(file);
    const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
    setPendingMedia((prev) => [...prev, { path, previewUrl, kind }]);
    toast.success("แนบรูปแล้ว — เพิ่มคำบรรยายแล้วกดโพสต์");
  };

  const removePending = async (idx: number) => {
    const m = pendingMedia[idx];
    if (!m) return;
    URL.revokeObjectURL(m.previewUrl);
    setPendingMedia((prev) => prev.filter((_, i) => i !== idx));
    supabase.storage.from("wall-media").remove([m.path]).catch(() => {});
  };

  const react = async (post: WallPost, type: string) => {
    if (!isReady) return;
    if (!userId) return toast.error("กรุณาเข้าสู่ระบบเพื่อกดถูกใจ");
    // Optimistic toggle
    const wasSame = post.my_reaction === type;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== post.id) return p;
        const prevType = post.my_reaction;
        const nextType = wasSame ? null : type;
        let like = p.like_count || 0;
        let heart = p.heart_count || 0;
        if (prevType === "like") like = Math.max(0, like - 1);
        if (prevType === "heart") heart = Math.max(0, heart - 1);
        if (nextType === "like") like += 1;
        if (nextType === "heart") heart += 1;
        return {
          ...p,
          my_reaction: nextType,
          like_count: like,
          heart_count: heart,
          reaction_count: like + heart,
        };
      })
    );
    if (wasSame) {
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
    if (!(await confirmDelete("ลบโพสต์นี้?", "การลบจะลบความคิดเห็น รีแอ็กชัน และไฟล์รูป/วิดีโอที่แนบทั้งหมด"))) return;
    // Fetch raw storage paths before deleting the row so we can clean up the bucket
    const { data: row } = await supabase
      .from("wall_posts")
      .select("media_urls")
      .eq("id", id)
      .maybeSingle();
    const { error, data } = await supabase.from("wall_posts").delete().eq("id", id).select();
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) return toast.error("ไม่มีสิทธิ์ลบโพสต์นี้");
    // Remove media files from storage (skip legacy full URLs — only delete storage paths)
    const paths = ((row?.media_urls as string[] | null) || []).filter(
      (v) => v && !/^(https?:|data:|blob:)/.test(v)
    );
    if (paths.length) {
      supabase.storage.from("wall-media").remove(paths).catch((e) => console.warn("storage cleanup failed", e));
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
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
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    e.target.value = "";
                    for (const f of files) await stageMedia(f);
                  }}
                />
                <Button asChild size="sm" variant="outline" disabled={uploading}>
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-1" />}
                    รูป/วิดีโอ
                  </span>
                </Button>
              </label>
              <Button
                size="sm"
                onClick={submit}
                disabled={posting || uploading || (!content.trim() && !linkUrl.trim() && pendingMedia.length === 0)}
              >
                <Send className="w-4 h-4 mr-1" />โพสต์
              </Button>
            </div>

            {pendingMedia.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t">
                {pendingMedia.map((m, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted">
                    {m.kind === "video" ? (
                      <video src={m.previewUrl} className="w-full h-32 object-cover" />
                    ) : (
                      <img src={m.previewUrl} alt="" className="w-full h-32 object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removePending(i)}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 hover:bg-black"
                      title="ลบไฟล์นี้"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {newPostCount > 0 && (
        <div className="sticky top-2 z-20 flex justify-center pointer-events-none">
          <Button
            size="sm"
            onClick={refreshFeed}
            className="pointer-events-auto rounded-full shadow-lg bg-primary hover:bg-primary/90 animate-in fade-in slide-in-from-top-2"
          >
            <Loader2 className="w-4 h-4 mr-1.5" />
            มีโพสต์ใหม่ {newPostCount} รายการ — คลิกเพื่อดู
          </Button>
        </div>
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
              {(p.author_id === userId || canModerate) && (
                <Button size="icon" variant="ghost" onClick={() => removePost(p.id)} title={canModerate && p.author_id !== userId ? "ลบโพสต์ (ผู้ดูแล)" : "ลบโพสต์"}>
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
                <span className="inline-flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{p.like_count || 0}</span>
                <span className="inline-flex items-center gap-1 ml-2"><Heart className="w-3 h-3" />{p.heart_count || 0}</span>
                <span className="ml-2">• {p.comment_count} ความคิดเห็น</span>
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
    if (!text.trim()) return;
    if (!userId) return toast.error("กรุณาเข้าสู่ระบบเพื่อแสดงความคิดเห็น");
    const chk = checkProfanity(text);
    if (!chk.ok) return toast.error(`ความคิดเห็นไม่เหมาะสม — ${chk.reason}`);
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
