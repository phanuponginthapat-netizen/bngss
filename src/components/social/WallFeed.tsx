import { useEffect, useState, useRef } from "react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { resolveSocialMedia, validSocialLink } from "@/lib/socialMedia";
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
import { swal } from "@/lib/swal";
import { detectMediaTypeFromUrl } from "@/lib/media";
import MediaRenderer from "./MediaRenderer";
import { saveErrorMessage } from "@/lib/saveError";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export default function WallFeed({ profileUserId, readOnly = false }: { profileUserId?: string; readOnly?: boolean }) {
  const { user, isReady } = useAuthSession();
  const userId = user?.id ?? null;
  const request = useRef(0);
  const [loadError, setLoadError] = useState("");
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("school");
  const [linkUrl, setLinkUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [staged, setStaged] = useState<StagedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const reactionLocks = useRef(new Set<string>());
  const [reactingIds, setReactingIds] = useState<string[]>([]);
  const { isAdmin: _rawA, isDirector: _rawD } = useUserRole(); const isAdmin = _rawA || _rawD;

  const load = async () => {
    const version = ++request.current;
    setLoading(true);
    setLoadError("");
    try {
    if (readOnly) {
      const { data, error } = await supabase.functions.invoke("public-wall-feed", { body: {} });
      if (error || data?.error) throw new Error(data?.error || "โหลดประชาสัมพันธ์ไม่สำเร็จ");
      if (version === request.current) setPosts(data.posts || []);
      return;
    }
    let q = supabase
      .from("wall_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (profileUserId) q = q.eq("author_id", profileUserId);
    const { data: rows, error } = await q;
    if (error) throw error;
    const list = await Promise.all(
      (rows || []).map(async (p: any) => ({
        ...p,
        media_urls: await Promise.all((p.media_urls || []).map((url: string) => resolveSocialMedia(url, "wall-media"))),
      }))
    ) as WallPost[];

    const ids = Array.from(new Set(list.map((p) => p.author_id)));
    const authors = new Map<string, any>();
    await Promise.all(
      ids.map(async (id) => {
        const { data, error } = await supabase.rpc("get_public_profile", { _id: id });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (row) authors.set(id, row);
      })
    );

    const myReactions = new Map<string, string>();
    if (userId && list.length) {
      const { data: rxs, error: reactionError } = await supabase
        .from("wall_post_reactions")
        .select("post_id, reaction_type")
        .eq("user_id", userId)
        .in("post_id", list.map((p) => p.id));
      if (reactionError) throw reactionError;
      (rxs || []).forEach((r: any) => myReactions.set(r.post_id, r.reaction_type));
    }

    if (version !== request.current) return;
    setPosts(list.map((p) => ({ ...p, author: authors.get(p.author_id), my_reaction: myReactions.get(p.id) ?? null })));
    } catch (e: any) { if (version === request.current) setLoadError(e.message || "โหลดฟีดไม่สำเร็จ"); }
    finally { if (version === request.current) setLoading(false); }
  };

  useEffect(() => {
    if (!isReady) return;
    setPosts([]);
    load();
    const ch = supabase
      .channel(`wall_feed-${profileUserId || "school"}-${userId || "guest"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wall_posts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "wall_post_reactions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "wall_post_comments" }, () => load())
      .subscribe();
    return () => {
      request.current++;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profileUserId, isReady, readOnly]);

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
    if (readOnly) return;
    if (posting || uploading) return;
    if (linkUrl.trim() && !validSocialLink(linkUrl)) return toast.error("ใส่ลิงก์ที่ขึ้นต้นด้วย https:// หรือ http://");
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
      visibility,
    });
    setPosting(false);
    if (error) return toast.error(saveErrorMessage(error));
    staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setStaged([]);
    setContent("");
    setLinkUrl("");
    toast.success("โพสต์เรียบร้อย");
    await load();
  };

  const react = async (post: WallPost, type: string) => {
    if (readOnly) return;
    if (!userId) return toast.error("กรุณาเข้าสู่ระบบ");
    if (reactionLocks.current.has(post.id)) return;
    reactionLocks.current.add(post.id);
    setReactingIds(current => [...current, post.id]);
    try {
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
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("wall_post_reactions")
        .upsert({ post_id: post.id, user_id: userId, reaction_type: type }, { onConflict: "post_id,user_id" });
      if (error) throw error;
    }
    } catch (error) { toast.error(saveErrorMessage(error)); await load(); }
    finally {
      reactionLocks.current.delete(post.id);
      setReactingIds(current => current.filter(id => id !== post.id));
    }
  };

  const removePost = async (id: string) => {
    if (readOnly) return;
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
      {!readOnly && userId && !profileUserId && (
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
              <Select value={visibility} onValueChange={setVisibility}><SelectTrigger aria-label="ผู้ที่เห็นโพสต์" className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="school">เฉพาะในโรงเรียน</SelectItem><SelectItem value="public">สาธารณะ · แสดงหน้าเว็บ</SelectItem></SelectContent></Select>
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

      {loadError && <div role="alert" className="text-destructive text-center py-6">{loadError}<Button variant="outline" onClick={load} className="ml-2">ลองใหม่</Button></div>}

      {!loading && !loadError && posts.length === 0 && (
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
              {!readOnly && (p.author_id === userId || isAdmin) && (
                <Button size="icon" variant="ghost" onClick={() => removePost(p.id)} title={isAdmin && p.author_id !== userId ? "ลบ (แอดมิน)" : "ลบโพสต์"}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>

            {p.content && <p className="whitespace-pre-wrap break-words text-sm">{p.content}</p>}

            {p.media_urls?.map((url, i) => (
              <MediaRenderer key={i} mediaType={detectMediaTypeFromUrl(url)} mediaUrl={url} />
            ))}

            {p.link_url && (
              <MediaRenderer
                mediaType={(p.link_type as any) || detectMediaTypeFromUrl(p.link_url)}
                mediaUrl={p.link_url}
              />
            )}

            {!readOnly && <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant={p.my_reaction === "like" ? "default" : "ghost"}
                disabled={reactingIds.includes(p.id)}
                onClick={() => react(p, "like")}
              >
                <ThumbsUp className="w-4 h-4 mr-1" />ถูกใจ
              </Button>
              <Button
                size="sm"
                variant={p.my_reaction === "heart" ? "default" : "ghost"}
                disabled={reactingIds.includes(p.id)}
                onClick={() => react(p, "heart")}
              >
                <Heart className="w-4 h-4 mr-1" />หัวใจ
              </Button>
              <div className="text-xs text-muted-foreground ml-auto">
                {p.reaction_count} ถูกใจ • {p.comment_count} ความคิดเห็น
              </div>
            </div>}

            {!readOnly && <CommentSection postId={p.id} userId={userId} commentCount={p.comment_count} />}
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
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const request = useRef(0);

  const load = async () => {
    const version = ++request.current;
    setLoadError("");
    try {
    const { data, error } = await supabase
      .from("wall_post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at");
    if (error) throw error;
    const list = (data || []) as Comment[];
    const ids = Array.from(new Set(list.map((c) => c.user_id)));
    const authors = new Map<string, any>();
    await Promise.all(
      ids.map(async (id) => {
        const { data, error } = await supabase.rpc("get_public_profile", { _id: id });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (row) authors.set(id, row);
      })
    );
    if (version === request.current) {
      setComments(list.map((c) => ({ ...c, author: authors.get(c.user_id) })));
      setLoaded(true);
    }
    } catch (error) {
      if (version === request.current) setLoadError(saveErrorMessage(error, "โหลดความคิดเห็นไม่สำเร็จ"));
    }
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
      request.current++;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line
  }, [postId]);

  const submit = async () => {
    if (!userId || !text.trim() || sending) return;
    setSending(true);
    try {
    const { error } = await supabase
      .from("wall_post_comments")
      .insert({ post_id: postId, user_id: userId, content: text.trim() });
    if (error) throw error;
    setText("");
    await load();
    } catch (error) { toast.error(saveErrorMessage(error)); }
    finally { setSending(false); }
  };

  const visible = expanded ? comments : comments.slice(-PREVIEW_LIMIT);
  const hiddenCount = comments.length - visible.length;

  return (
    <div className="space-y-2">
      {loadError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">{loadError}<Button size="sm" variant="outline" onClick={load}>ลองโหลดความคิดเห็นใหม่</Button></div>}
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
            <p className="whitespace-pre-wrap break-words text-sm">{c.content}</p>
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
          <Button size="sm" disabled={sending || !text.trim()} aria-label="ส่งความคิดเห็น" onClick={submit} className="rounded-full"><Send className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
