import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "@/components/office/office.css";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, Presentation, FileType, RefreshCw, Cloud } from "lucide-react";
import { listRecentOfficeFiles, editorRouteForMime, iconForMime, DriveFile } from "@/lib/office/driveFileIO";
import { supabase } from "@/integrations/supabase/client";
import { isDriveCredentialMissingError } from "@/lib/googleDriveErrors";

const APPS = [
  { key: "docs", title: "เอกสาร", desc: "Word / .docx", icon: FileText, to: "/dashboard/office/docs", color: "docs" },
  { key: "sheets", title: "ตารางคำนวณ", desc: "Excel / .xlsx", icon: FileSpreadsheet, to: "/dashboard/office/sheets", color: "sheets" },
  { key: "slides", title: "นำเสนอ", desc: "PowerPoint / .pptx", icon: Presentation, to: "/dashboard/office/slides", color: "slides" },
  { key: "pdf", title: "PDF Tools", desc: "แก้ไข / เซ็น / รวมไฟล์", icon: FileType, to: "/dashboard/office/pdf", color: "pdf" },
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
    setFiles([]); setConnected(null);
    try {
      // Check connection first to avoid triggering a 428 error on the proxy.
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { setConnected(false); setLoading(false); return; }
      const { data: conn, error: connectionError } = await supabase
        .from("app_user_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("connector_id", "google_drive")
        .maybeSingle();
      if (connectionError) throw connectionError;
      if (!conn) { setConnected(false); setLoading(false); return; }
      setConnected(true);
      setFiles(await listRecentOfficeFiles(24));
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (e?.code === "DRIVE_NOT_CONNECTED" || msg.includes("not_connected") || msg.includes("428") || isDriveCredentialMissingError(msg)) setConnected(false);
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
          <p className="text-sm text-muted-foreground">พื้นที่ทำงานของคุณ</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">สร้างใหม่</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {APPS.map(a => <Button key={a.key} variant="outline" asChild className={`office-app-${a.color} h-auto justify-start p-4 whitespace-normal`}><Link to={a.to}><span className="office-app-icon p-3 rounded-md"><a.icon className="h-7 w-7" /></span><span className="text-left min-w-0"><span className="block font-semibold">{a.title}</span><span className="text-xs text-muted-foreground">{a.desc}</span></span></Link></Button>)}
        </div>
      </section>
      <section className="border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="flex items-center gap-2 font-semibold"><Cloud className="w-5 h-5 text-primary" />ไฟล์ล่าสุด</h2>
          <Button variant="ghost" size="sm" asChild><Link to="/dashboard/my-drive">Google Drive →</Link></Button>
        </div>
        <div>
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
          {!loading && !error && files.length > 0 && (
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
        </div>
      </section>
    </div>
  );
}
