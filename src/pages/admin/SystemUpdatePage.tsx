import { useState } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Link as LinkIcon, RefreshCw, History, Package, Database } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SystemUpdatePage() {
  const qc = useQueryClient();
  const { lang } = useLanguage();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["config_bundles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("config_bundles" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
  });

  const exportBundle = async () => {
    setLoading("export");
    try {
      const { data, error } = await supabase.functions.invoke("system-update", { body: { action: "export" } });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `smart-school-config-${todayBangkok()}.json`;
      a.click();
      toast.success(lang === "th" ? "ดาวน์โหลด bundle แล้ว" : "Bundle downloaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(null); }
  };

  const fullBackup = async () => {
    setLoading("backup");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/system-backup`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `smart-school-backup-${todayBangkok()}.zip`;
      a.click();
      toast.success(lang === "th" ? "ดาวน์โหลด backup สำเร็จ" : "Backup downloaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(null); }
  };

  const applyFromUrl = async () => {
    if (!url) return toast.error(lang === "th" ? "ใส่ลิงก์ก่อน" : "Enter URL");
    setLoading("url");
    try {
      const { data, error } = await supabase.functions.invoke("system-update", { body: { action: "apply", url } });
      if (error) throw error;
      toast.success(lang === "th" ? "อัพเดทสำเร็จ" : "Update applied");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["config_bundles"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(null); }
  };

  const applyFromFile = async (file: File) => {
    setLoading("file");
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      const { data, error } = await supabase.functions.invoke("system-update", { body: { action: "apply", bundle } });
      if (error) throw error;
      toast.success(lang === "th" ? "อัพเดทสำเร็จ" : "Update applied");
      qc.invalidateQueries({ queryKey: ["config_bundles"] });
      
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(null); }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Package className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{lang === "th" ? "อัพเดทระบบจากไฟล์/ลิงก์" : "System Update Bundle"}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "th"
              ? "Export ค่าตั้งระบบจากที่หนึ่ง → Apply ไปอีกหลายๆ โรงเรียนได้จากไฟล์หรือลิงก์เดียว"
              : "Export config from one site, apply to many via a single file or URL"}
          </p>
        </div>
      </div>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            {lang === "th" ? "Full Backup ทั้งระบบ" : "Full System Backup"}
          </CardTitle>
          <CardDescription>
            {lang === "th"
              ? "ดาวน์โหลดข้อมูลทั้งหมด: ทุกตาราง + ไฟล์ในที่เก็บข้อมูล (รูป/PDF/เอกสาร) เป็นไฟล์ .zip เดียว"
              : "Download EVERYTHING: all DB tables + all storage files (images/PDFs) as one .zip"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fullBackup} disabled={loading === "backup"} variant="default">
            <Database className="h-4 w-4 mr-2" />
            {loading === "backup"
              ? (lang === "th" ? "กำลังสำรองข้อมูล..." : "Backing up...")
              : (lang === "th" ? "สำรองข้อมูลทั้งระบบ (.zip)" : "Backup Full System (.zip)")}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            {lang === "th"
              ? "อาจใช้เวลาสักครู่หากข้อมูลเยอะ — กรุณาอย่าปิดหน้านี้"
              : "May take a while for large datasets — don't close this page"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{lang === "th" ? "ส่งออกค่าตั้ง (Config Bundle)" : "Export Config Bundle"}</CardTitle>
          <CardDescription>
            {lang === "th"
              ? "ดาวน์โหลด bundle ของค่าตั้งระบบ (CMS, school settings, รายการ API keys โดยไม่รวมค่า secret)"
              : "Download config bundle (CMS, school settings, API key names — values excluded)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportBundle} disabled={loading === "export"} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            {loading === "export" ? "..." : (lang === "th" ? "ดาวน์โหลด Bundle" : "Download Bundle")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{lang === "th" ? "อัพเดทจากลิงก์ (URL)" : "Apply from URL"}</CardTitle>
          <CardDescription>
            {lang === "th"
              ? "วาง URL ของไฟล์ JSON bundle (เช่น GitHub Raw, S3, Lovable Storage)"
              : "Paste URL to a JSON bundle (GitHub Raw, S3, Storage)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <Button onClick={applyFromUrl} disabled={loading === "url"}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading === "url" ? "animate-spin" : ""}`} />
            {lang === "th" ? "อัพเดท" : "Apply"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{lang === "th" ? "อัพเดทจากไฟล์" : "Apply from File"}</CardTitle>
          <CardDescription>{lang === "th" ? "เลือกไฟล์ .json bundle จากเครื่อง" : "Pick a .json bundle file"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="bundle-file" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md border bg-background hover:bg-accent">
            <Upload className="h-4 w-4" />
            {loading === "file" ? "..." : (lang === "th" ? "เลือกไฟล์" : "Choose file")}
          </Label>
          <Input
            id="bundle-file"
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) applyFromFile(f);
              e.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> {lang === "th" ? "ประวัติการอัพเดท" : "Update History"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">{lang === "th" ? "ยังไม่มีประวัติ" : "No history"}</p>}
          {history.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <div className="font-mono text-sm">{h.version}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("th-TH", { hour12: false })}
                  {h.source_url && <> • {h.source_url}</>}
                </div>
              </div>
              <Badge variant={h.status === "applied" ? "default" : "secondary"}>{h.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
