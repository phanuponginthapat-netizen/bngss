import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CloudDownload, Plus, RefreshCw, Trash2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function UpstreamSyncPage() {
  const qc = useQueryClient();
  const { lang } = useLanguage();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [pulling, setPulling] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);

  const checkAllNow = async () => {
    setCheckingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-pull-bundle", { body: {} });
      if (error) throw error;
      const results = (data as any)?.results || [];
      const applied = results.filter((r: any) => r.status === "applied" || r.status === "partial").length;
      const upToDate = results.filter((r: any) => r.status === "up_to_date").length;
      const errors = results.filter((r: any) => r.status === "error").length;
      qc.invalidateQueries({ queryKey: ["upstream_subscription"] });
      if (errors > 0) toast.error(lang === "th" ? `อัพเดท ${applied} • ล่าสุด ${upToDate} • ผิดพลาด ${errors}` : `Updated ${applied} • Up-to-date ${upToDate} • Errors ${errors}`);
      else if (applied > 0) toast.success(lang === "th" ? `อัพเดทสำเร็จ ${applied} ต้นทาง` : `Updated ${applied} upstream(s)`);
      else toast.success(lang === "th" ? "ทุกอย่างเป็นเวอร์ชันล่าสุดแล้ว" : "Everything up-to-date");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setCheckingAll(false); }
  };

  const { data: subs = [] } = useQuery({
    queryKey: ["upstream_subscription"],
    queryFn: async () => {
      const { data } = await supabase
        .from("upstream_subscription" as any)
        .select("*")
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
  });

  const add = async () => {
    if (!name || !url) return toast.error(lang === "th" ? "กรอกชื่อและลิงก์ก่อน" : "Name and URL required");
    const { error } = await supabase.from("upstream_subscription" as any).insert({ name, bundle_url: url, auto_pull: true });
    if (error) return toast.error(error.message);
    setName(""); setUrl("");
    qc.invalidateQueries({ queryKey: ["upstream_subscription"] });
    toast.success(lang === "th" ? "เพิ่มแล้ว — ระบบจะดึงทุก 6 ชม." : "Added — auto-pull every 6h");
  };

  const remove = async (id: string) => {
    await supabase.from("upstream_subscription" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["upstream_subscription"] });
  };

  const toggleAuto = async (id: string, v: boolean) => {
    await supabase.from("upstream_subscription" as any).update({ auto_pull: v }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["upstream_subscription"] });
  };

  const pullNow = async (id: string) => {
    setPulling(id);
    try {
      const { data, error } = await supabase.functions.invoke("auto-pull-bundle", { body: { id } });
      if (error) throw error;
      toast.success(lang === "th" ? "ดึงสำเร็จ" : "Pulled");
      qc.invalidateQueries({ queryKey: ["upstream_subscription"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setPulling(null); }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <CloudDownload className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">
            {lang === "th" ? "ซิงค์อัตโนมัติจากต้นทาง (Auto-pull)" : "Upstream Auto-sync"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "th"
              ? "ตั้งลิงก์ bundle ต้นทางครั้งเดียว → ระบบดึงและอัพเดทอัตโนมัติทุก 6 ชม. (ไม่ต้องกดเอง)"
              : "Set the upstream bundle URL once — system auto-pulls every 6h"}
          </p>
        </div>
        <Button onClick={checkAllNow} disabled={checkingAll} size="lg" className="ml-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${checkingAll ? "animate-spin" : ""}`} />
          {lang === "th" ? "ตรวจอัพเดททันที" : "Check for updates now"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{lang === "th" ? "เพิ่มต้นทาง" : "Add upstream"}</CardTitle>
          <CardDescription>
            {lang === "th"
              ? "ใช้ลิงก์ GitHub Raw หรือ Lovable Storage ที่ public (HTTPS เท่านั้น)"
              : "GitHub Raw or public Lovable Storage URL (HTTPS only)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[200px_1fr_auto]">
          <div>
            <Label className="text-xs">{lang === "th" ? "ชื่อ" : "Name"}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="main-template" />
          </div>
          <div>
            <Label className="text-xs">URL</Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/..." />
            </div>
          </div>
          <div className="flex items-end">
            <Button onClick={add}><Plus className="h-4 w-4 mr-2" />{lang === "th" ? "เพิ่ม" : "Add"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{lang === "th" ? "รายการต้นทาง" : "Subscriptions"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {subs.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {lang === "th" ? "ยังไม่มีต้นทาง" : "No upstream yet"}
            </p>
          )}
          {subs.map((s: any) => (
            <div key={s.id} className="border rounded-lg p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground truncate">{s.bundle_url}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  {s.last_status && <Badge variant={s.last_status === "applied" ? "default" : s.last_status === "error" ? "destructive" : "secondary"}>{s.last_status}</Badge>}
                  {s.last_version && <span className="font-mono">{s.last_version}</span>}
                  {s.last_pulled_at && <span>• {new Date(s.last_pulled_at).toLocaleString()}</span>}
                  {s.last_error && <span className="text-destructive">• {s.last_error}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs">
                  <Switch checked={s.auto_pull} onCheckedChange={(v) => toggleAuto(s.id, v)} />
                  Auto
                </div>
                <Button size="sm" variant="outline" onClick={() => pullNow(s.id)} disabled={pulling === s.id}>
                  <RefreshCw className={`h-4 w-4 ${pulling === s.id ? "animate-spin" : ""}`} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="text-base">{lang === "th" ? "วิธีใช้ (สำหรับ รร. ลูก)" : "How to use (for child schools)"}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>1. {lang === "th" ? "โรงเรียนต้นแบบ Export bundle (.json) จากหน้า System Update" : "Template school exports bundle (.json) from System Update page"}</p>
          <p>2. {lang === "th" ? "Upload .json ไปที่ GitHub repo (path: bundles/latest.json) → ใช้ลิงก์ Raw" : "Upload .json to GitHub repo (bundles/latest.json) → use Raw URL"}</p>
          <p>3. {lang === "th" ? "ทุก รร. ลูก เพิ่ม URL นั้นในหน้านี้ ครั้งเดียว → ระบบ pull อัตโนมัติทุก 6 ชม." : "Each child school adds the URL here once — auto-pulls every 6h"}</p>
          <p>4. {lang === "th" ? "เวลามีอัพเดท: แค่ push bundle ใหม่ขึ้น GitHub → รร. ทุกแห่งได้รับภายใน 6 ชม." : "On update: push new bundle to GitHub → all schools receive within 6h"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
