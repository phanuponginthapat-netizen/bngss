import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, Presentation, FileType, RefreshCw, Cloud } from "lucide-react";
import { listRecentOfficeFiles, editorRouteForMime, iconForMime, DriveFile } from "@/lib/office/driveFileIO";
import { supabase } from "@/integrations/supabase/client";

const APPS = [
  { key: "docs", title: "เอกสาร", desc: "Word / .docx", icon: FileText, to: "/dashboard/office/docs", color: "from-blue-500 to-blue-600" },
  { key: "sheets", title: "ตารางคำนวณ", desc: "Excel / .xlsx", icon: FileSpreadsheet, to: "/dashboard/office/sheets", color: "from-emerald-500 to-emerald-600" },
  { key: "slides", title: "นำเสนอ", desc: "PowerPoint / .pptx", icon: Presentation, to: "/dashboard/office/slides", color: "from-orange-500 to-orange-600" },
  { key: "pdf", title: "PDF Tools", desc: "แก้ไข / เซ็น / รวมไฟล์", icon: FileType, to: "/dashboard/office/pdf", color: "from-rose-500 to-rose-600" },
];

export default function OfficeHomePage() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Check connection first to avoid triggering a 428 error on the proxy.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setConnected(false); setLoading(false); return; }
      const { data: conn } = await supabase
        .from("app_user_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("connector_id", "google_drive")
        .maybeSingle();
      if (!conn) { setConnected(false); setLoading(false); return; }
      setConnected(true);
      setFiles(await listRecentOfficeFiles(24));
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("not_connected") || msg.includes("428")) setConnected(false);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);


  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Office Suite</h1>
          <p className="text-sm text-muted-foreground">สร้างและแก้ไขเอกสาร ตาราง สไลด์ และ PDF บันทึกลง Google Drive ของคุณ</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {APPS.map(a => (
          <Link key={a.key} to={a.to} className="group">
            <Card className="h-full overflow-hidden border-2 hover:border-primary transition-all hover:shadow-lg">
              <div className={`h-2 bg-gradient-to-r ${a.color}`} />
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-white`}>
                  <a.icon className="w-6 h-6" />
                </div>
                <div className="font-semibold">{a.title}</div>
                <div className="text-xs text-muted-foreground">{a.desc}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cloud className="w-5 h-5 text-blue-500" />
            ไฟล์ล่าสุดใน Google Drive
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/my-drive">เปิด Drive ทั้งหมด →</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-8 text-muted-foreground">กำลังโหลด…</div>}
          {!loading && connected === false && (
            <div className="text-center py-8 space-y-3">
              <div className="text-sm text-muted-foreground">ยังไม่ได้เชื่อม Google Drive — เชื่อมเพื่อบันทึกและเปิดไฟล์</div>
              <Button size="sm" onClick={() => nav("/dashboard/my-drive")}>เชื่อม Google Drive</Button>
            </div>
          )}
          {!loading && error && (
            <div className="text-center py-8 text-sm text-destructive">{error}</div>
          )}
          {!loading && connected && files.length === 0 && !error && (
            <div className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีไฟล์ Office ใน Drive — สร้างใหม่ได้จากเมนูด้านบน</div>
          )}
          {!loading && files.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {files.map(f => (
                <Link
                  key={f.id}
                  to={editorRouteForMime(f.mimeType, f.id)}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <span className="text-2xl">{iconForMime(f.mimeType)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.modifiedTime && new Date(f.modifiedTime).toLocaleString("th-TH")}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
