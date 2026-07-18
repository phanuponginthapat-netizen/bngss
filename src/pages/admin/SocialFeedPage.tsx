import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { saveWithToast } from "@/lib/saveWithToast";
import {
  Facebook, RefreshCw, ExternalLink, Trash2, CheckCircle2, AlertTriangle,
  BookOpen, Eye, EyeOff, KeyRound,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { swal } from "@/lib/swal";

const SETTING_KEYS = ["fb_page_id", "fb_page_access_token"];

export default function SocialFeedPage() {
  const [pageId, setPageId] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastResult, setLastResult] = useState<any>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const loadConfig = async () => {
    const { data } = await supabase
      .from("school_settings")
      .select("setting_key, setting_value")
      .in("setting_key", SETTING_KEYS);
    const map: Record<string, string> = {};
    (data || []).forEach((d) => { map[d.setting_key] = d.setting_value || ""; });
    setPageId(map.fb_page_id || "");
    setToken(map.fb_page_access_token || "");
  };

  const loadPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("social_posts")
      .select("*")
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(30);
    setPosts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadConfig();
    loadPosts();
  }, []);

  const upsertSetting = async (key: string, value: string) => {
    return supabase
      .from("school_settings")
      .upsert({ setting_key: key, setting_value: value.trim() }, { onConflict: "setting_key" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveWithToast(async () => {
        const { error: e1 } = await upsertSetting("fb_page_id", pageId);
        const { error: e2 } = await upsertSetting("fb_page_access_token", token);
        if (e1 || e2) throw new Error(e1?.message || e2?.message);
      }, {
        loading: "กำลังบันทึกการตั้งค่า...",
        success: "บันทึกการตั้งค่าเรียบร้อย",
        error: "บันทึกไม่สำเร็จ",
      });
    } catch {
      /* toast already shown */
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("social-feed-sync", {
        body: { broadcast: true, limit: 15 },
      });
      if (error) throw error;
      setLastResult(data);
      toast.success(`ดึงโพสต์: ${data?.fetched ?? 0} · เพิ่มใหม่: ${data?.inserted ?? 0} · ส่ง LINE: ${data?.broadcasted ?? 0}`);
      await loadPosts();
    } catch (e: any) {
      toast.error("ดึงข้อมูลล้มเหลว: " + (e?.message || "unknown"));
      setLastResult({ error: e?.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await swal.confirm({ title: "ลบโพสต์นี้ออกจาก Social Wall?", danger: true }))) return;
    const { error } = await supabase.from("social_posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("ลบแล้ว");
      loadPosts();
    }
  };

  const isConfigured = !!pageId && !!token;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Facebook className="h-6 w-6 text-sky-600" />
            Social Wall · ฟีดจาก Facebook Page
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ดึงโพสต์จากเพจ Facebook ของโรงเรียนอัตโนมัติทุก 15 นาที พร้อม Broadcast ไปยัง LINE OA
          </p>
        </div>
        <Button variant="outline" onClick={() => setGuideOpen(true)}>
          <BookOpen className="h-4 w-4 mr-2" />
          คู่มือเชื่อมต่อ Facebook
        </Button>
      </div>

      {!isConfigured && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>ยังไม่ได้เชื่อมต่อ Facebook Page</AlertTitle>
          <AlertDescription className="text-xs">
            กดปุ่ม <b>"คู่มือเชื่อมต่อ Facebook"</b> ด้านบนเพื่อดูขั้นตอนการขอ Page ID และ Access Token
            จากนั้นนำมาวางในช่องด้านล่าง — ทำครั้งเดียว ใช้ถาวร
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            ตั้งค่า Facebook Page
          </CardTitle>
          <CardDescription>
            {isConfigured ? (
              <span className="inline-flex items-center gap-1 text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> เชื่อมต่อแล้ว
              </span>
            ) : (
              "ยังไม่ได้กรอกข้อมูล"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Facebook Page ID</Label>
            <Input
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder="เช่น 1234567890123456"
            />
            <p className="text-xs text-muted-foreground">
              หา Page ID ได้จาก About → Page Transparency บนเพจ Facebook
            </p>
          </div>

          <div className="space-y-2">
            <Label>Page Access Token</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="EAAG... (วาง Long-Lived / System User Token)"
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              แนะนำ <b>System User Token</b> (ไม่หมดอายุ) — ดูวิธีในปุ่มคู่มือด้านบน
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
            </Button>
            <Button variant="secondary" onClick={handleSync} disabled={syncing || !isConfigured}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "กำลังดึง…" : "ดึงโพสต์ทันที + Broadcast"}
            </Button>
          </div>

          {lastResult && (
            <div className="text-xs bg-muted/40 rounded-lg p-3">
              {lastResult.error ? (
                <span className="text-destructive">❌ {lastResult.error}</span>
              ) : (
                <span className="text-success flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  ดึง {lastResult.fetched} โพสต์ · เพิ่มใหม่ {lastResult.inserted} · ส่ง LINE {lastResult.broadcasted} รายการ
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">โพสต์ที่ดึงมาแล้ว ({posts.length})</CardTitle>
          <CardDescription>โพสต์เหล่านี้แสดงบน Dashboard และหน้าเว็บสาธารณะ</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-8">กำลังโหลด…</div>
          ) : posts.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">ยังไม่มีโพสต์ — กดปุ่ม "ดึงโพสต์ทันที"</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {posts.map((p) => (
                <div key={p.id} className="border rounded-xl overflow-hidden">
                  {p.thumbnail_url && (
                    <div className="aspect-video bg-muted">
                      <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    <p className="text-xs line-clamp-3">{p.content || "(ไม่มีข้อความ)"}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <div className="flex gap-1 items-center">
                        {p.broadcasted_at ? (
                          <Badge variant="secondary" className="text-[10px]">✓ ส่ง LINE แล้ว</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">ยังไม่ broadcast</Badge>
                        )}
                      </div>
                      <span>{p.posted_at ? new Date(p.posted_at).toLocaleString("th-TH") : ""}</span>
                    </div>
                    <div className="flex gap-1 pt-1">
                      {p.permalink && (
                        <a href={p.permalink} target="_blank" rel="noreferrer" className="flex-1">
                          <Button variant="outline" size="sm" className="w-full h-7 text-[11px]">
                            <ExternalLink className="h-3 w-3 mr-1" /> เปิดบน FB
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* คู่มือ */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-sky-600" />
              คู่มือเชื่อมต่อ Facebook Page (แบบถาวร)
            </DialogTitle>
            <DialogDescription>
              ใช้ <b>System User Token</b> — ตั้งครั้งเดียว ใช้ได้ตลอดชีวิต ไม่หมดอายุ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 text-sm">
            <section className="space-y-2">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Badge>ขั้น 1</Badge> หา Facebook Page ID
              </h3>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-2">
                <li>เปิดเพจ Facebook ของโรงเรียน</li>
                <li>กด <b>About</b> → เลื่อนลงหา <b>Page Transparency</b></li>
                <li>คัดลอกตัวเลข <b>Page ID</b> (16 หลัก)</li>
              </ol>
            </section>

            <Separator />

            <section className="space-y-2">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Badge>ขั้น 2</Badge> สร้าง Facebook App
              </h3>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-2">
                <li>
                  ไปที่{" "}
                  <a className="underline text-primary" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
                    developers.facebook.com/apps
                  </a>
                </li>
                <li>กด <b>Create App</b> → เลือก <b>Business</b> → ตั้งชื่อ App</li>
                <li>เพิ่ม Product: <b>Facebook Login for Business</b></li>
              </ol>
            </section>

            <Separator />

            <section className="space-y-2">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Badge>ขั้น 3</Badge> สร้าง System User Token (ถาวร)
              </h3>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-2">
                <li>
                  ไปที่{" "}
                  <a className="underline text-primary" href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer">
                    Business Settings → System Users
                  </a>
                </li>
                <li>กด <b>Add</b> → ตั้งชื่อ (เช่น "School Feed Bot") → Role: <b>Admin</b></li>
                <li>เลือก System User ที่สร้าง → กด <b>Add Assets</b> → เลือกเพจโรงเรียน → ติ๊ก <b>Manage Page</b></li>
                <li>
                  กด <b>Generate New Token</b> → เลือก App ที่สร้างในขั้น 2 → Expiration: <b>Never</b>
                </li>
                <li>
                  ติ๊ก permissions: <code className="text-xs bg-muted px-1 rounded">pages_read_engagement</code>,{" "}
                  <code className="text-xs bg-muted px-1 rounded">pages_show_list</code>,{" "}
                  <code className="text-xs bg-muted px-1 rounded">pages_read_user_content</code>
                </li>
                <li>กด <b>Generate Token</b> → คัดลอกเก็บไว้ (จะเห็นแค่ครั้งเดียว!)</li>
              </ol>
              <Alert className="mt-3">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Token นี้ <b>ไม่หมดอายุ</b> — เก็บไว้ในที่ปลอดภัย ใช้ได้แม้จะ remix โปรเจคใหม่ก็แค่นำมาวางอีกครั้ง
                </AlertDescription>
              </Alert>
            </section>

            <Separator />

            <section className="space-y-2">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Badge>ขั้น 4</Badge> นำมาวางในระบบ
              </h3>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-2">
                <li>ปิดหน้าต่างนี้</li>
                <li>วาง <b>Page ID</b> และ <b>Access Token</b> ในช่องด้านล่าง</li>
                <li>กด <b>"บันทึกการตั้งค่า"</b></li>
                <li>กด <b>"ดึงโพสต์ทันที + Broadcast"</b> เพื่อทดสอบ</li>
              </ol>
            </section>

            <Alert variant="default" className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-sm">ทางเลือก: แบบเร็ว (Long-Lived Token)</AlertTitle>
              <AlertDescription className="text-xs">
                ถ้ายังไม่อยากตั้ง Business Manager ใช้{" "}
                <a className="underline" href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer">
                  Graph API Explorer
                </a>{" "}
                สร้าง Page Access Token → แลกเป็น Long-Lived Token (อยู่ได้จนกว่าจะเปลี่ยนรหัส FB)
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => setGuideOpen(false)}>เข้าใจแล้ว เริ่มตั้งค่า</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
