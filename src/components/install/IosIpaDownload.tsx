import { useQuery } from "@tanstack/react-query";
import { Apple, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BASE = "https://gwmszzoqqxmejefhayqf.supabase.co/storage/v1/object/public/app-downloads";

type Release = { version: string; releasedAt: string; files: { name: string; url: string; sizeBytes: number }[] };

/** ดาวน์โหลด IPA สำหรับติดตั้งเองโดยไม่ผ่าน App Store (ใช้ release-ios.json จากงานสร้าง) */
export default function IosIpaDownload() {
  const { data, isLoading } = useQuery({
    queryKey: ["release-ios"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        const r = await fetch(`${BASE}/release-ios.json?t=${Date.now()}`, { cache: "no-store" });
        return r.ok ? ((await r.json()) as Release) : null;
      } catch { return null; }
    },
  });
  const ipa = data?.files.find((f) => f.name.toLowerCase().endsWith(".ipa"));
  const plist = data?.files.find((f) => f.name.toLowerCase().endsWith(".plist"));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Apple className="w-5 h-5" /> ดาวน์โหลด IPA (iPhone / iPad)
          {data?.version && <Badge variant="secondary" className="ml-auto">v{data.version}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">ติดตั้งแอปลงเครื่องเองโดยยังไม่ผ่าน App Store</p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">กำลังตรวจสอบรุ่นล่าสุด...</p>
        ) : ipa ? (
          <div className="space-y-2">
            {plist && (
              <Button asChild className="w-full" size="lg">
                <a href={`itms-services://?action=download-manifest&url=${encodeURIComponent(plist.url)}`}>
                  <Download className="w-4 h-4 mr-2" /> ติดตั้งลงเครื่องนี้ทันที
                </a>
              </Button>
            )}
            <Button asChild variant={plist ? "outline" : "default"} className="w-full" size="lg">
              <a href={ipa.url} download={ipa.name}>
                <Download className="w-4 h-4 mr-2" /> ดาวน์โหลดไฟล์ .ipa ({(ipa.sizeBytes / 1048576).toFixed(1)} MB)
              </a>
            </Button>
            <ol className="space-y-1 text-sm list-decimal pl-5">
              {plist ? (
                <li>เปิดหน้านี้ด้วย Safari บน iPhone แล้วแตะ "ติดตั้งลงเครื่องนี้ทันที"</li>
              ) : (
                <li>ดาวน์โหลดไฟล์ .ipa ลงคอมพิวเตอร์ แล้วติดตั้งผ่านโปรแกรม Sideloadly หรือ AltStore</li>
              )}
              <li>ไปที่ ตั้งค่า → ทั่วไป → VPN และการจัดการอุปกรณ์ แล้วกด "เชื่อถือ" ผู้พัฒนา</li>
              <li>iOS 16 ขึ้นไป: เปิด ตั้งค่า → ความเป็นส่วนตัวและความปลอดภัย → โหมดนักพัฒนา</li>
            </ol>
            <Alert>
              <AlertDescription className="text-xs">
                เครื่องที่ติดตั้งได้ต้องลงทะเบียนกับบัญชีผู้พัฒนา Apple ของโรงเรียนไว้ก่อน หากติดตั้งไม่ได้ ให้ใช้วิธีเพิ่มไปยังหน้าจอโฮมด้านล่างแทน
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">ยังไม่มีไฟล์ IPA ให้ดาวน์โหลด</AlertTitle>
            <AlertDescription className="text-xs">
              ระหว่างนี้ใช้วิธี "เพิ่มไปยังหน้าจอโฮม" ด้านล่างได้เลย ใช้งานและรับแจ้งเตือนได้เหมือนกัน
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
