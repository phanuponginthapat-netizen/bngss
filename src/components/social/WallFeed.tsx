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
import { Heart, ThumbsUp, MessageCircle, Image as ImageIcon, Send, Trash2, X, Loader2 } from "lucide-react";
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

interface StagedMedia {
  path: string;      // storage path
  previewUrl: string; // local blob URL for preview
  file: File;
}

export default function WallFeed({ profileUserId }: { profileUserId?: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [staged, setStaged] = useState<StagedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const { isAdmin: _rawA, isDirector: _rawD } = useUserRole(); const isAdmin = _rawA || _rawD;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const resolveMediaUrl = async (val: string): Promise<string> => {
    if (!val) return val;
    if (/^(https?:|data:|blob:)/.test(val)) return val;
    const { data } = await supabase.storage.from("wall-media").createSignedUrl(val, 60 * 60);
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

    const ids = Array.from(new Set(list.map((p) => p.author_id)));
    const authors = new Map<string, any>();
    await Promise.all(
      ids.map(async (id) => {
        const { data } = await supabase.rpc("get_public_profile", { _id: id });
        const row = Array.isArray(data) ? data[0] : data;
        if (row) authors.set(id, row);
      })
    );

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

  const stageFiles = async (files: FileList | null) => {
    if (!files || !userId) return;
    setUploading(true);
    try {
      const out: StagedMedia[] = [];
      for (const file of Array.from(files)) {
        const path = sanitizeStorageKey(`${userId}/${Date.now()}-${file.name}`);
        const { error: upErr } = await supabase.storage.from("wall-media").upload(path, file);
        if (upErr) { toast.error(upErr.message); continue; }
        out.push({ path, previewUrl: URL.createObjectURL(file), file });
      }
      setStaged((prev) => [...prev, ...out]);
    } finally {
      setUploading(false);
    }
  };

  const removeStaged = async (idx: number) => {
    const item = staged[idx];
    if (!item) return;
    URL.revokeObjectURL(item.previewUrl);
    // best-effort cleanup from storage
    supabase.storage.from("wall-media").remove([item.path]).catch(() => {});
    setStaged((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!userId) return toast.error("กรุณาเข้าสู่ระบบ");
    if (!content.trim() && !linkUrl.trim() && staged.length === 0)
      return toast.error("เพิ่มข้อความ ลิงก์ หรือรูป/วิดีโอ");
    setPosting(true);
    const link_type = linkUrl ? detectMediaTypeFromUrl(linkUrl) : null;
    const { error } = await supabase.from("wall_posts").insert({
      author_id: userId,
      content: content.trim() || null,
      link_url: linkUrl.trim() || null,
      link_type,
      media_urls: staged.map((s) => s.path),
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setStaged([]);
    setContent("");
    setLinkUrl("");
    toast.success("โพสต์เรียบร้อย");
  };

  const react = async (post: WallPost, type: string) => {
    if (!userId) return toast.error("กรุณาเข้าสู่ระบบ");
    const wasType = post.my_reaction;
    const removing = wasType === type;
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
    const ok = await swal.confirm({
      title: "ยืนยันการลบโพสต์?",
      text: "โพสต์นี้จะถูกลบถาวร ไม่สามารถกู้คืนได้",
      confirmText: "ลบโพสต์",
      cancelText: "ยกเลิก",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("wall_posts").delete().eq("id", id);
    if (error) return swal.error("ลบไม่สำเร็จ", error.message);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    swal.success("ลบโพสต์แล้ว");
  };

  return (
    <div className="space-y-4">
      {userId && !profileUserId && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Textarea
              placeholder="แบ่งปันกิจกรรม ผลงาน หรือข้อความถึงทุกคนในโรงเรียน..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />

            {staged.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {staged.map((s, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden border bg-muted/30 aspect-video">
                    {s.file.type.startsWith("video/") ? (
                      <video src={s.previewUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={s.previewUrl} alt="preview" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeStaged(i)}
                      className="absolute top-1 right-1 bg-background/80 hover:bg-background rounded-full p-1 shadow"
                      aria-label="ลบไฟล์แนบ"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

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
                  onChange={(e) => { stageFiles(e.target.files); e.target.value = ""; }}
                />
                <Button asChild size="sm" variant="outline" disabled={uploading}>
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-1" />}
                    รูป/วิดีโอ
                  </span>
                </Button>
              </label>
              <Button size="sm" onClick={submit} disabled={posting || uploading}>
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

            <CommentSection postId={p.id} userId={userId} commentCount={p.comment_count} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const PREVIEW_LIMIT = 2;

function CommentSection({ postId, userId, commentCount }: { postId: string; userId: string | null; commentCount: number }) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);

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
    setLoaded(true);
  };

  // Load a preview automatically (FB-style) whenever the post has comments.
  useEffect(() => {
    if (commentCount > 0) load();
    // eslint-disable-next-line
  }, [commentCount, postId]);

  useEffect(() => {
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
  }, [postId]);

  const submit = async () => {
    if (!userId || !text.trim()) return;
    const { error } = await supabase
      .from("wall_post_comments")
      .insert({ post_id: postId, user_id: userId, content: text.trim() });
    if (error) return toast.error(error.message);
    setText("");
  };

  const visible = expanded ? comments : comments.slice(-PREVIEW_LIMIT);
  const hiddenCount = comments.length - visible.length;

  return (
    <div className="space-y-2">
      {loaded && hiddenCount > 0 && (
        <Button size="sm" variant="ghost" className="h-auto px-1 py-1 text-xs" onClick={() => setExpanded(true)}>
          <MessageCircle className="w-3.5 h-3.5 mr-1" />
          ดูความคิดเห็นก่อนหน้าอีก {hiddenCount} ความคิดเห็น
        </Button>
      )}
      {visible.map((c) => (
        <div key={c.id} className="flex gap-2 items-start text-sm">
          <Avatar className="w-7 h-7">
            <AvatarImage src={c.author?.avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px]">{initials(c.author)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 bg-muted/50 rounded-2xl px-3 py-2">
            <p className="font-medium text-xs">{fullName(c.author)}</p>
            <p className="whitespace-pre-wrap text-sm">{c.content}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {new Date(c.created_at).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
            </p>
          </div>
        </div>
      ))}
      {expanded && comments.length > PREVIEW_LIMIT && (
        <Button size="sm" variant="ghost" className="h-auto px-1 py-1 text-xs" onClick={() => setExpanded(false)}>
          ย่อความคิดเห็น
        </Button>
      )}
      {userId && (
        <div className="flex gap-2 pt-1">
          <Input
            placeholder="เขียนความคิดเห็น..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
            className="rounded-full"
          />
          <Button size="sm" onClick={submit} className="rounded-full"><Send className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
