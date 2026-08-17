import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Server, Loader2, HardDrive, RotateCcw } from "lucide-react";
import {
  getBackendConfig,
  getConfigSource,
  saveBackendConfig,
  clearBackendConfig,
  testBackendConnection,
  isUsingDefaultBackend,
} from "@/lib/runtimeConfig";

/**
 * ตั้งค่า backend ภายนอก (Supabase self-hosted) แบบ runtime
 * ใช้ได้ทันทีหลัง deploy ใหม่ทุกครั้ง โดยไม่ต้อง build ใหม่
 */
export default function BackendConnectionCard() {
  const cfg = getBackendConfig();
  const [url, setUrl] = useState(cfg.url);
  const [anonKey, setAnonKey] = useState(cfg.anonKey);
  const [projectId, setProjectId] = useState(cfg.projectId ?? "");
  const [storage, setStorage] = useState<"supabase" | "gdrive">(cfg.storageProvider ?? "supabase");
  const [testing, setTesting] = useState(false);

  const testAndSave = async () => {
    if (!url || !anonKey) return toast.error("กรอก URL และ anon key ก่อน");
    setTesting(true);
    try {
      await testBackendConnection(url, anonKey);
      saveBackendConfig({ url, anonKey, projectId, storageProvider: storage });
      toast.success("เชื่อมต่อสำเร็จ — กำลังรีโหลดระบบ");
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      toast.error(`เชื่อมต่อไม่ได้: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  const reset = () => {
    clearBackendConfig();
    toast.success("ล้างค่าแล้ว — กลับไปใช้ค่าจาก build/app-config.js");
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <Card className="border-2 border-sky-300/60">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-sky-600" />
          <div className="flex-1">
            <CardTitle>เชื่อมต่อ Backend ภายนอก (Supabase self-hosted)</CardTitle>
            <CardDescription>
              ตั้งค่าได้ทันทีหลัง deploy ใหม่ (Vercel / Cloudflare) โดยไม่ต้อง build ใหม่
            </CardDescription>
          </div>
          <Badge variant="secondary">ค่าปัจจุบันมาจาก: {getConfigSource()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isUsingDefaultBackend() && (
          <Alert>
            <AlertDescription className="text-xs">
              กำลังใช้ <b>backend เริ่มต้น</b> ของโรงเรียนต้นทาง — ถ้านำระบบไปใช้ที่อื่น
              ให้กรอก Supabase ของคุณเองด้านล่าง หรือแก้ไฟล์ <code>/app-config.js</code>{" "}
              (ดูขั้นตอนทั้งหมดที่ <code>docs/PORTABLE-DEPLOY.md</code>)
            </AlertDescription>
          </Alert>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Supabase URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://db.myschool.ac.th" />
          </div>
          <div className="space-y-1">
            <Label>Anon / Publishable Key</Label>
            <Input value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJhbGciOi..." />
          </div>
          <div className="space-y-1">
            <Label>Project ID (ถ้ามี)</Label>
            <Input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="my-school" />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1">
              <HardDrive className="h-3.5 w-3.5" /> ที่เก็บไฟล์/รูปภาพ
            </Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={storage}
              onChange={(e) => setStorage(e.target.value as "supabase" | "gdrive")}
            >
              <option value="supabase">Supabase Storage</option>
              <option value="gdrive">Google Drive</option>
            </select>
          </div>
        </div>

        {storage === "gdrive" && (
          <Alert>
            <AlertDescription className="text-xs">
              โหมด Google Drive ต้องตั้ง secrets บน backend: <code>GOOGLE_CLIENT_ID</code>,{" "}
              <code>GOOGLE_CLIENT_SECRET</code>, <code>GOOGLE_DRIVE_REFRESH_TOKEN</code> และ (ถ้าต้องการ){" "}
              <code>GOOGLE_DRIVE_FOLDER_ID</code> — ไฟล์ทั้งหมดจะถูกอัปโหลดผ่าน edge function{" "}
              <code>drive-storage</code>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={testAndSave} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Server className="h-4 w-4 mr-2" />}
            ทดสอบและบันทึก
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> ล้างค่า (ใช้ค่าเริ่มต้น)
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          หมายเหตุ: ค่านี้เก็บในเบราว์เซอร์เครื่องนี้ ถ้าต้องการให้ทุกคนใช้ค่าเดียวกัน ให้แก้ไฟล์{" "}
          <code>/app-config.js</code> ที่โฮสต์ไว้ (แก้ได้เลยหลัง deploy)
        </p>
      </CardContent>
    </Card>
  );
}
