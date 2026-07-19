import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, File as FileIcon, ChevronRight, RefreshCw, Search, Download, ExternalLink, Home, LogOut, Upload } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
}

interface ConnectionInfo {
  account_email: string | null;
  account_name: string | null;
  connected_at: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

function formatSize(bytes?: string) {
  if (!bytes) return "";
  const n = Number(bytes);
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function MyDrivePage() {
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([{ id: "root", name: "My Drive" }]);
  const [search, setSearch] = useState("");
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);

  const currentFolder = breadcrumb[breadcrumb.length - 1];

  // Load connection state
  const loadConnection = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("app_user_connections")
      .select("account_email, account_name, connected_at")
      .eq("user_id", user.id)
      .eq("connector_id", "google_drive")
      .is("revoked_at", null)
      .maybeSingle();
    setConnection(data as any);
  }, []);

  useEffect(() => { loadConnection(); }, [loadConnection]);

  // Handle drive_status query after OAuth return
  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("drive_status");
    if (status) {
      url.searchParams.delete("drive_status");
      window.history.replaceState({}, "", url.toString());
      if (status === "connected") { swal.success("เชื่อม Google Drive สำเร็จ"); loadConnection(); }
      else swal.error("เชื่อม Drive ไม่สำเร็จ", status);
    }
  }, [loadConnection]);

  const fetchFiles = useCallback(async (folderId: string, q?: string, token?: string) => {
    setLoading(true);
    try {
      const queryParts: string[] = ["trashed=false"];
      if (q) queryParts.push(`name contains '${q.replace(/'/g, "\\'")}'`);
      else queryParts.push(`'${folderId}' in parents`);

      const { data, error } = await supabase.functions.invoke("gdrive-proxy", {
        body: {
          path: "/files",
          method: "GET",
          query: {
            q: queryParts.join(" and "),
            fields: "nextPageToken, files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,parents)",
            pageSize: 100,
            orderBy: "folder,name",
            pageToken: token,
            spaces: "drive",
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          },
        },
      });
      if (error) throw error;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      setFiles(token ? [...files, ...(parsed.files ?? [])] : parsed.files ?? []);
      setNextPageToken(parsed.nextPageToken);
    } catch (e: any) {
      toast.error("โหลดไฟล์ไม่สำเร็จ: " + (e.message ?? e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connection) fetchFiles(currentFolder.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, currentFolder.id]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const returnUrl = `${window.location.origin}/dashboard/my-drive`;
      const { data, error } = await supabase.functions.invoke("gdrive-connect-start", {
        body: { return_url: returnUrl },
      });
      if (error) throw error;
      const parsed: any = typeof data === "string" ? JSON.parse(data) : data;
      if (!parsed?.authorize_url) throw new Error("ไม่ได้รับ authorize_url");
      window.location.href = parsed.authorize_url;
    } catch (e: any) {
      swal.error("เริ่มการเชื่อมต่อไม่สำเร็จ", e.message ?? String(e));
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await swal.confirm({ title: "ยกเลิกการเชื่อม Google Drive?", text: "ระบบจะไม่สามารถเข้าถึงไฟล์ของคุณอีก" });
    if (!ok) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("app_user_connections").delete().eq("user_id", user.id).eq("connector_id", "google_drive");
    setConnection(null); setFiles([]); setBreadcrumb([{ id: "root", name: "My Drive" }]);
    toast.success("ยกเลิกการเชื่อมแล้ว");
  };

  const openFolder = (f: DriveFile) => {
    setBreadcrumb([...breadcrumb, { id: f.id, name: f.name }]);
    setSearch("");
  };

  const goCrumb = (idx: number) => {
    setBreadcrumb(breadcrumb.slice(0, idx + 1));
    setSearch("");
  };

  const download = async (f: DriveFile) => {
    if (f.mimeType.startsWith("application/vnd.google-apps.")) {
      window.open(f.webViewLink, "_blank");
      return;
    }
    toast.loading("กำลังดาวน์โหลด…", { id: "dl" });
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const resp = await fetch(`https://dlkyxvhnnffblerwedjz.supabase.co/functions/v1/gdrive-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsa3l4dmhubmZmYmxlcndlZGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjY5MTIsImV4cCI6MjA5OTk0MjkxMn0.bQqqX3veJ_pGr9fSa0a-bKIS-w7UmR569a2xDZQ6Cx4",
        },
        body: JSON.stringify({ path: `/files/${f.id}`, method: "GET", query: { alt: "media" } }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = f.name; a.click();
      URL.revokeObjectURL(url);
      toast.success("ดาวน์โหลดสำเร็จ", { id: "dl" });
    } catch (e: any) {
      toast.error("ดาวน์โหลดไม่สำเร็จ: " + (e.message ?? e), { id: "dl" });
    }
  };

  const runSearch = () => {
    if (!search.trim()) { fetchFiles(currentFolder.id); return; }
    fetchFiles(currentFolder.id, search.trim());
  };

  if (!connection) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card className="p-8 text-center space-y-4">
          <FolderOpen className="w-16 h-16 mx-auto text-blue-500" />
          <h1 className="text-2xl font-bold">Google Drive ของฉัน</h1>
          <p className="text-muted-foreground">
            เชื่อมบัญชี Google Drive ส่วนตัวของคุณ เพื่อเปิด/ดาวน์โหลด/จัดการไฟล์ได้ในระบบ<br />
            (คุณเห็นและใช้ไฟล์ของตัวเองเท่านั้น เหมือนเปิด drive.google.com)
          </p>
          <Button size="lg" onClick={handleConnect} disabled={connecting}>
            <FolderOpen className="w-4 h-4 mr-2" /> เชื่อม Google Drive
          </Button>
          <p className="text-xs text-muted-foreground pt-4">
            เชื่อมครั้งเดียว • ยกเลิกได้ทุกเมื่อ • ระบบจะไม่แชร์ไฟล์ของคุณให้คนอื่น
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-500" /> Google Drive ของฉัน
            </h1>
            <p className="text-xs text-muted-foreground">
              เชื่อมเป็น: <span className="font-medium">{connection.account_email ?? connection.account_name ?? "Google account"}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fetchFiles(currentFolder.id)}>
              <RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDisconnect}>
              <LogOut className="w-4 h-4 mr-1" /> ยกเลิกการเชื่อม
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-wrap text-sm">
          {breadcrumb.map((b, i) => (
            <div key={b.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              <button className="hover:underline hover:text-primary" onClick={() => goCrumb(i)}>
                {i === 0 ? <Home className="w-4 h-4 inline mr-1" /> : null}{b.name}
              </button>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="ค้นหาไฟล์ทั้ง Drive…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <Button size="sm" onClick={runSearch}><Search className="w-4 h-4" /></Button>
        </div>

        {/* Files */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {loading && files.length === 0
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)
            : files.map((f) => {
                const isFolder = f.mimeType === FOLDER_MIME;
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition"
                    onDoubleClick={() => isFolder ? openFolder(f) : download(f)}
                    onClick={() => isFolder && openFolder(f)}
                  >
                    {isFolder
                      ? <FolderOpen className="w-6 h-6 text-blue-500 shrink-0" />
                      : (f.iconLink
                          ? <img src={f.iconLink} alt="" className="w-6 h-6 shrink-0" />
                          : <FileIcon className="w-6 h-6 text-gray-500 shrink-0" />)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{f.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {isFolder ? "โฟลเดอร์" : formatSize(f.size)}
                        {f.modifiedTime && ` · ${new Date(f.modifiedTime).toLocaleDateString("th-TH")}`}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {f.webViewLink && (
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); window.open(f.webViewLink, "_blank"); }}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      {!isFolder && (
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); download(f); }}>
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          {!loading && files.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              โฟลเดอร์นี้ว่างเปล่า
            </div>
          )}
        </div>

        {nextPageToken && (
          <div className="text-center pt-3">
            <Button variant="outline" size="sm" onClick={() => fetchFiles(currentFolder.id, search || undefined, nextPageToken)}>
              โหลดเพิ่มเติม
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
