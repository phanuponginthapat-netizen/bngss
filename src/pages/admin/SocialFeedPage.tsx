import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { saveWithToast } from "@/lib/saveWithToast";
import {
  Facebook, Youtube, Music2, Instagram, ExternalLink, Trash2, CheckCircle2,
  Link2, Plus, Sparkles, Globe, ListVideo,
} from "lucide-react";
import { swal } from "@/lib/swal";
import { detectPlatform, isSupportedSocialUrl, postEmbedSrc } from "@/lib/socialEmbeds";

const PAGE_URL_KEY = "fb_page_url";
const TT_CHANNEL_KEY = "tiktok_channel_url";
const YT_CHANNEL_KEY = "youtube_channel_url";

const platformMeta: Record<string, { label: string; Icon: any; color: string }> = {
  facebook: { label: "Facebook", Icon: Facebook, color: "text-info" },
  youtube: { label: "YouTube", Icon: Youtube, color: "text-destructive" },
  tiktok: { label: "TikTok", Icon: Music2, color: "text-foreground" },
  instagram: { label: "Instagram", Icon: Instagram, color: "text-pink-500" },
};

const PlatformBadge = ({ p }: { p: string }) => {
  const m = platformMeta[p];
  if (!m) return <Badge variant="outline" className="gap-1"><Link2 className="h-3 w-3" /> {p}</Badge>;
  const { Icon, label, color } = m;
  return <Badge variant="outline" className="gap-1"><Icon className={`h-3 w-3 ${color}`} /> {label}</Badge>;
};

export default function SocialFeedPage() {
  const [pageUrl, setPageUrl] = useState("");
  const [ttChannelUrl, setTtChannelUrl] = useState("");
  const [ytChannelUrl, setYtChannelUrl] = useState("");
  const [savingPage, setSavingPage] = useState(false);
  const [savingTt, setSavingTt] = useState(false);
  const [savingYt, setSavingYt] = useState(false);
  const [newPostUrl, setNewPostUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const loadConfig = async () => {
    const { data } = await supabase
      .from("school_settings")
      .select("setting_key,setting_value")
      .in("setting_key", [PAGE_URL_KEY, TT_CHANNEL_KEY, YT_CHANNEL_KEY]);
    const map = Object.fromEntries((data || []).map((r: any) => [r.setting_key, r.setting_value]));
    setPageUrl(map[PAGE_URL_KEY] || "");
    setTtChannelUrl(map[TT_CHANNEL_KEY] || "");
    setYtChannelUrl(map[YT_CHANNEL_KEY] || "");
  };

  const loadPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("social_posts")
      .select("*")
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(80);
    setPosts(data || []);
    setLoading(false);
  };

  useEffect(() => { loadConfig(); loadPosts(); }, []);

  const savePageUrl = async () => {
    const url = pageUrl.trim();
    if (url) {
      try {
        const u = new URL(url);
        if (!/facebook\.com$/.test(u.hostname.replace(/^www\./, ""))) {
          toast.error("ลิงก์เพจต้องเป็น facebook.com");
          return;
        }
      } catch { toast.error("ลิงก์เพจไม่ถูกต้อง"); return; }
    }
    setSavingPage(true);
    try {
      await saveWithToast(async () => {
        const { error } = await supabase
          .from("school_settings")
          .upsert({ setting_key: PAGE_URL_KEY, setting_value: url }, { onConflict: "setting_key" });
        if (error) throw error;
      }, { loading: "กำลังบันทึก…", success: "บันทึกลิงก์เพจแล้ว", error: "บันทึกไม่สำเร็จ" });
    } finally { setSavingPage(false); }
  };

  const saveTtChannel = async () => {
    const url = ttChannelUrl.trim();
    if (url) {
      try {
        const u = new URL(url);
        if (!/tiktok\.com$/.test(u.hostname.replace(/^www\./, "")) || !/\/@/.test(u.pathname)) {
          toast.error("ลิงก์ช่องต้องเป็น https://www.tiktok.com/@username");
          return;
        }
      } catch { toast.error("ลิงก์ช่อง TikTok ไม่ถูกต้อง"); return; }
    }
    setSavingTt(true);
    try {
      await saveWithToast(async () => {
        const { error } = await supabase
          .from("school_settings")
          .upsert({ setting_key: TT_CHANNEL_KEY, setting_value: url }, { onConflict: "setting_key" });
        if (error) throw error;
      }, { loading: "กำลังบันทึก…", success: "บันทึกลิงก์ช่อง TikTok แล้ว", error: "บันทึกไม่สำเร็จ" });
    } finally { setSavingTt(false); }
  };

  const saveYtChannel = async () => {
    const url = ytChannelUrl.trim();
    if (url) {
      try {
        const u = new URL(url);
        if (!/youtube\.com$/.test(u.hostname.replace(/^www\./, "")) && u.hostname !== "youtu.be") {
          toast.error("ลิงก์ต้องเป็น youtube.com");
          return;
        }
      } catch { toast.error("ลิงก์ช่อง YouTube ไม่ถูกต้อง"); return; }
    }
    setSavingYt(true);
    try {
      await saveWithToast(async () => {
        const { error } = await supabase
          .from("school_settings")
          .upsert({ setting_key: YT_CHANNEL_KEY, setting_value: url }, { onConflict: "setting_key" });
        if (error) throw error;
      }, { loading: "กำลังบันทึก…", success: "บันทึกลิงก์ช่อง YouTube แล้ว", error: "บันทึกไม่สำเร็จ" });
    } finally { setSavingYt(false); }
  };

  const addPost = async () => {
    const url = newPostUrl.trim();
    if (!url) return;
    const platform = detectPlatform(url);
    if (platform === "unknown") return toast.error("รองรับเฉพาะ Facebook · YouTube · TikTok · Instagram");
    const embed = postEmbedSrc(url);
    if (!embed && (platform === "youtube" || platform === "tiktok")) {
      return toast.error(`อ่านรหัสคลิป ${platformMeta[platform].label} จากลิงก์นี้ไม่ได้`);
    }
    setAdding(true);
    try {
      const externalId = `manual_${platform}_${btoa(url).slice(0, 40)}`;
      const { error } = await supabase.from("social_posts").upsert({
        platform, external_id: externalId, permalink: url, content: null, posted_at: new Date().toISOString(),
      }, { onConflict: "external_id" });
      if (error) throw error;
      toast.success("เพิ่มลิงก์เรียบร้อย");
      setNewPostUrl("");
      loadPosts();
    } catch (e: any) {
      toast.error(e?.message || "เพิ่มไม่สำเร็จ");
    } finally { setAdding(false); }
  };

  const removePost = async (id: string) => {
    if (!(await swal.confirm({ title: "ลบลิงก์นี้ออกจาก Social Wall?", danger: true }))) return;
    const { error } = await supabase.from("social_posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("ลบแล้ว"); loadPosts(); }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length, facebook: 0, youtube: 0, tiktok: 0, instagram: 0 };
    posts.forEach((p) => { c[p.platform] = (c[p.platform] || 0) + 1; });
    return c;
  }, [posts]);

  const filtered = filter === "all" ? posts : posts.filter((p) => p.platform === filter);
  const newPlatform = newPostUrl ? detectPlatform(newPostUrl) : "unknown";
  const supported = newPostUrl && isSupportedSocialUrl(newPostUrl);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-info/10 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />
              Social Wall · ฟีดโซเชียลโรงเรียน
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
              รวมโพสต์/คลิปจาก <b>Facebook · YouTube · TikTok · Instagram</b> ไว้ในที่เดียว
              เพียง <b>วางลิงก์</b> ระบบจะฝังโพสต์ให้อัตโนมัติ — <span className="text-success font-medium">ไม่ต้องใช้ Token, ไม่ต้องเชื่อม API</span>
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 h-7"><Sparkles className="h-3.5 w-3.5" /> Link-Only Mode</Badge>
        </div>
      </div>

      {/* Quick add */}
      <Card className="border-primary/30 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> เพิ่มลิงก์โพสต์ / คลิป
          </CardTitle>
          <CardDescription>วาง URL จาก Facebook · YouTube · TikTok · Instagram แล้วกด Enter</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input
              value={newPostUrl}
              onChange={(e) => setNewPostUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…   หรือ   https://www.tiktok.com/@user/video/…"
              className="flex-1 min-w-[280px] font-mono text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") addPost(); }}
            />
            <Button onClick={addPost} disabled={adding || !newPostUrl || newPlatform === "unknown"} className="gap-1">
              <Plus className="h-4 w-4" /> {adding ? "กำลังเพิ่ม…" : "เพิ่มลงฟีด"}
            </Button>
          </div>
          {newPostUrl && (
            <div className={`text-xs flex items-center gap-1.5 ${supported ? "text-success" : "text-destructive"}`}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {supported
                ? <>ตรวจพบ: <b>{platformMeta[newPlatform]?.label || newPlatform}</b></>
                : "ยังไม่รู้จักลิงก์นี้ (รองรับเฉพาะ FB / YT / TikTok / IG)"}
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground border-t pt-3">
            <div>📘 <b>Facebook:</b> โพสต์ → กดวันที่ → คัดลอก URL</div>
            <div>▶️ <b>YouTube:</b> Share → Copy (รองรับ Shorts)</div>
            <div>🎵 <b>TikTok:</b> Share → Copy link</div>
          </div>
        </CardContent>
      </Card>

      {/* Facebook Page URL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Facebook className="h-4 w-4 text-info" /> ลิงก์เพจ Facebook ของโรงเรียน
          </CardTitle>
          <CardDescription>
            ใช้แสดง <b>Facebook Page Plugin</b> บนหน้าเว็บโรงเรียน (Facebook โหลดฟีดให้เอง) — ตัวเลือกเสริม ไม่บังคับ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Input
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="https://www.facebook.com/your-school-page"
              className="flex-1 min-w-[280px]"
            />
            <Button onClick={savePageUrl} disabled={savingPage} variant="outline">
              {savingPage ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TikTok Channel URL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Music2 className="h-4 w-4" /> ลิงก์ช่อง TikTok ของโรงเรียน
          </CardTitle>
          <CardDescription>
            ใส่ลิงก์ช่อง (เช่น <code>https://www.tiktok.com/@school</code>) เพื่อฝัง <b>หน้าโปรไฟล์ช่อง</b> ลงในฟีด — ตัวเลือกเสริม ไม่บังคับ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Input
              value={ttChannelUrl}
              onChange={(e) => setTtChannelUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@your-school"
              className="flex-1 min-w-[280px]"
            />
            <Button onClick={saveTtChannel} disabled={savingTt} variant="outline">
              {savingTt ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* YouTube Channel/Playlist URL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Youtube className="h-4 w-4 text-destructive" /> ลิงก์ช่อง YouTube ของโรงเรียน
          </CardTitle>
          <CardDescription>
            ใส่ลิงก์ช่อง (<code>/channel/UCxxxx</code> หรือ <code>/@handle</code>) หรือลิงก์เพลย์ลิสต์ (<code>?list=...</code>) เพื่อฝังวิดีโอช่องในฟีด — แนะนำใช้ลิงก์เพลย์ลิสต์เพื่อความเสถียร
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Input
              value={ytChannelUrl}
              onChange={(e) => setYtChannelUrl(e.target.value)}
              placeholder="https://www.youtube.com/@your-school  หรือ  https://www.youtube.com/playlist?list=PL..."
              className="flex-1 min-w-[280px]"
            />
            <Button onClick={saveYtChannel} disabled={savingYt} variant="outline">
              {savingYt ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ListVideo className="h-4 w-4" /> รายการบนฟีด ({posts.length})
              </CardTitle>
              <CardDescription>โพสต์เหล่านี้แสดงบน Dashboard และหน้าเว็บสาธารณะ</CardDescription>
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["all", "facebook", "youtube", "tiktok", "instagram"] as const).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={filter === k ? "default" : "outline"}
                  className="h-7 text-xs gap-1"
                  onClick={() => setFilter(k)}
                >
                  {k === "all" ? "ทั้งหมด" : platformMeta[k].label}
                  <span className="opacity-70">({counts[k] || 0})</span>
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-10">กำลังโหลด…</div>
          ) : filtered.length === 0 ? (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertTitle>ยังไม่มีลิงก์ในฟีด</AlertTitle>
              <AlertDescription className="text-xs">วางลิงก์ในช่อง "เพิ่มลิงก์โพสต์ / คลิป" ด้านบนเพื่อเริ่มต้น</AlertDescription>
            </Alert>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {filtered.map((p) => (
                <div key={p.id} className="group flex items-center gap-3 border rounded-xl p-3 hover:bg-muted/40 transition">
                  <div className="shrink-0">
                    {(() => {
                      const m = platformMeta[p.platform];
                      const Icon = m?.Icon || Link2;
                      return <Icon className={`h-5 w-5 ${m?.color || ""}`} />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono truncate">{p.permalink || "(ไม่มีลิงก์)"}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                      <PlatformBadge p={p.platform} />
                      {p.posted_at && <span>{new Date(p.posted_at).toLocaleString("th-TH")}</span>}
                    </div>
                  </div>
                  {p.permalink && (
                    <a href={p.permalink} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => removePost(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
