import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Download,
  ExternalLink,
  File as FileIcon,
  FolderOpen,
  Home,
  KeyRound,
  Link2,
  LogOut,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
import { useUserRole } from "@/hooks/useUserRole";

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
  last_used_at?: string | null;
  external_user_id?: string | null;
}

interface AdminDriveStatus {
  clientConfigured: boolean;
  connectionKeySecretConfigured: boolean;
  lovableApiKeyConfigured: boolean;
  callbackUrl: string;
  checkedAt: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gdrive-proxy`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function formatSize(bytes?: string) {
  if (!bytes) return "";
  const n = Number(bytes);
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatThaiDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function driveStatusCopy(status: string) {
  if (status === "connected") {
    return {
      title: "เชื่อม Google Drive สำเร็จ",
      text: "บัญชี Google Drive พร้อมใช้งานแล้ว",
    };
  }

  const code = status.replace(/^error:/, "");
  const map: Record<string, { title: string; text: string }> = {
    no_key: {
      title: "เชื่อม Drive ไม่สำเร็จ",
      text: "ระบบไม่ได้รับรหัสเชื่อมต่อจาก Google Drive ให้ผู้ดูแลตรวจแท็บตั้งค่า Drive แล้วเชื่อมใหม่อีกครั้ง",
    },
    no_connection_key: {
      title: "เชื่อม Drive ไม่สำเร็จ",
      text: "ระบบแลกรหัสเชื่อมต่อแล้ว แต่ไม่ได้รับกุญแจใช้งาน Drive กรุณากดเชื่อมใหม่อีกครั้ง",
    },
    exchange_failed: {
      title: "เชื่อม Drive ไม่สำเร็จ",
      text: "ระบบแลกรหัสเชื่อมต่อ Google Drive ไม่สำเร็จ กรุณากดเชื่อมใหม่อีกครั้ง",
    },
    invalid_exchange_code: {
      title: "ลิงก์เชื่อมต่อหมดอายุ",
      text: "รหัสเชื่อมต่อถูกใช้ไปแล้วหรือหมดอายุ กรุณากดเชื่อม Google Drive ใหม่อีกครั้ง",
    },
    access_denied: {
      title: "ผู้ใช้ยกเลิกการอนุญาต",
      text: "ยังไม่ได้อนุญาตให้ระบบเข้าถึง Google Drive กรุณากดเชื่อมต่ออีกครั้งและยืนยันสิทธิ์ให้ครบ",
    },
    no_user: {
      title: "ไม่พบผู้ใช้ในระบบ",
      text: "กรุณาเข้าสู่ระบบใหม่ แล้วลองเชื่อม Google Drive อีกครั้ง",
    },
    bad_state: {
      title: "ลิงก์เชื่อมต่อหมดอายุ",
      text: "เพื่อความปลอดภัย กรุณากดเชื่อม Google Drive ใหม่อีกครั้ง",
    },
    db: {
      title: "บันทึกการเชื่อมต่อไม่สำเร็จ",
      text: "ฐานข้อมูลไม่สามารถบันทึกสถานะ Drive ได้ กรุณาลองใหม่หรือแจ้งผู้ดูแลระบบ",
    },
  };
  return map[code] ?? {
    title: "เชื่อม Drive ไม่สำเร็จ",
    text: `สาเหตุ: ${status}`,
  };
}

async function readInvokeError(error: any) {
  if (!error) return "";
  try {
    if (error.context?.text) {
      const text = await error.context.text();
      if (text) return text;
    }
  } catch {
    // ignore body read failures
  }
  return error.message ?? String(error);
}

export default function MyDrivePage() {
  const { role, realRole } = useUserRole();
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([{ id: "root", name: "My Drive" }]);
  const [search, setSearch] = useState("");
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState(() => new URL(window.location.href).searchParams.get("tab") === "settings" ? "settings" : "files");
  const [lastOAuthStatus, setLastOAuthStatus] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<AdminDriveStatus | null>(null);
  const [checkingAdminStatus, setCheckingAdminStatus] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const currentFolder = breadcrumb[breadcrumb.length - 1];
  const canManageDrive = realRole === "admin" || role === "admin";
  const currentTab = canManageDrive ? activeTab : "files";

  // Load connection state
  const loadConnection = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("app_user_connections")
      .select("account_email, account_name, connected_at, last_used_at, external_user_id")
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
      setLastOAuthStatus(status);
      const copy = driveStatusCopy(status);
      if (status === "connected") {
        swal.success(copy.title, copy.text);
        loadConnection();
        setActiveTab("files");
      } else {
        setActiveTab("settings");
        swal.error(copy.title, copy.text);
      }
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
      if (error) throw new Error(await readInvokeError(error));
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      setFiles((prev) => token ? [...prev, ...(parsed.files ?? [])] : parsed.files ?? []);
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

  const handleConnect = async (tab: "files" | "settings" = currentTab as "files" | "settings") => {
    setConnecting(true);
    try {
      const returnUrl = `${window.location.origin}/dashboard/my-drive?tab=${tab}`;
      const { data, error } = await supabase.functions.invoke("gdrive-connect-start", {
        body: { return_url: returnUrl },
      });
      if (error) throw new Error(await readInvokeError(error));
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

  const handleReconnect = async () => {
    const ok = await swal.confirm({
      title: "เชื่อม Google Drive ใหม่?",
      text: "ระบบจะล้างสถานะเดิมในแอป แล้วให้คุณอนุญาต Google Drive อีกครั้ง",
      confirmText: "เชื่อมใหม่",
    });
    if (!ok) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("app_user_connections").delete().eq("user_id", user.id).eq("connector_id", "google_drive");
    }
    setConnection(null);
    setFiles([]);
    setBreadcrumb([{ id: "root", name: "My Drive" }]);
    await handleConnect("settings");
  };

  const checkAdminStatus = async () => {
    setCheckingAdminStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke("gdrive-admin-status", { body: {} });
      if (error) throw new Error(await readInvokeError(error));
      setAdminStatus((typeof data === "string" ? JSON.parse(data) : data) as AdminDriveStatus);
      toast.success("ตรวจการตั้งค่า Drive แล้ว");
    } catch (e: any) {
      toast.error("ตรวจการตั้งค่าไม่สำเร็จ: " + (e.message ?? e));
    } finally {
      setCheckingAdminStatus(false);
    }
  };

  useEffect(() => {
    if (canManageDrive && currentTab === "settings" && !adminStatus) checkAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageDrive, currentTab]);

  const testDriveConnection = async () => {
    if (!connection) return;
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("gdrive-proxy", {
        body: {
          path: "/about",
          method: "GET",
          query: { fields: "user,storageQuota" },
        },
      });
      if (error) throw new Error(await readInvokeError(error));
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      toast.success(`Drive พร้อมใช้งาน: ${parsed?.user?.emailAddress ?? "บัญชีนี้"}`);
    } catch (e: any) {
      toast.error("ทดสอบ Drive ไม่ผ่าน: " + (e.message ?? e));
    } finally {
      setTestingConnection(false);
    }
  };

  const copyCallbackUrl = async () => {
    const callbackUrl = adminStatus?.callbackUrl ?? "https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback";
    await navigator.clipboard.writeText(callbackUrl);
    toast.success("คัดลอก Callback URL แล้ว");
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
      const resp = await fetch(FUNCTIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": ANON,
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

  const ConnectionSetupCard = () => (
    <Card className="p-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Google Drive ของฉัน</h1>
          </div>
          <p className="text-muted-foreground">
            เชื่อมบัญชี Google Drive ส่วนตัวของคุณ เพื่อเปิด/ดาวน์โหลด/จัดการไฟล์ได้ในระบบ
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant={connection ? "default" : "secondary"}>
              {connection ? "เชื่อมแล้ว" : "ยังไม่ได้เชื่อม"}
            </Badge>
            {connection?.account_email && <Badge variant="outline">{connection.account_email}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {connection ? (
            <Button onClick={handleReconnect} disabled={connecting}>
              <RotateCcw className="w-4 h-4 mr-2" /> เชื่อมใหม่
            </Button>
          ) : (
            <Button size="lg" onClick={() => handleConnect("settings")} disabled={connecting}>
              <FolderOpen className="w-4 h-4 mr-2" /> เชื่อม Google Drive
            </Button>
          )}
        </div>
      </div>

      {lastOAuthStatus && lastOAuthStatus !== "connected" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{driveStatusCopy(lastOAuthStatus).title}</AlertTitle>
          <AlertDescription>{driveStatusCopy(lastOAuthStatus).text}</AlertDescription>
        </Alert>
      )}

      {connection && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">บัญชีที่เชื่อม</p>
            <p className="font-medium truncate">{connection.account_email ?? connection.account_name ?? "Google account"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">เชื่อมเมื่อ</p>
            <p className="font-medium">{formatThaiDateTime(connection.connected_at)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">ใช้งานล่าสุด</p>
            <p className="font-medium">{formatThaiDateTime(connection.last_used_at)}</p>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        เชื่อมครั้งเดียว • ยกเลิกได้ทุกเมื่อ • ระบบจะไม่แชร์ไฟล์ของคุณให้คนอื่น
      </p>
    </Card>
  );

  const AdminSettingsCard = () => {
    if (!canManageDrive) return null;
    const allReady = !!adminStatus?.clientConfigured && !!adminStatus?.connectionKeySecretConfigured && !!adminStatus?.lovableApiKeyConfigured;
    const callbackUrl = adminStatus?.callbackUrl ?? "https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback";

    return (
      <Card className="p-6 space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">ตั้งค่า Google Drive สำหรับผู้ดูแล</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              ใช้สำหรับตรวจความพร้อมของตัวเชื่อมระบบ รีเซ็ตการเชื่อมต่อ และเชื่อมบัญชี Drive ใหม่เมื่อ OAuth มีปัญหา
            </p>
          </div>
          <Button variant="outline" onClick={checkAdminStatus} disabled={checkingAdminStatus}>
            <RefreshCw className="w-4 h-4 mr-2" /> ตรวจการตั้งค่า
          </Button>
        </div>

        <Alert variant={allReady ? "default" : "destructive"}>
          {allReady ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{allReady ? "ตัวเชื่อม Drive พร้อมใช้งาน" : "ยังต้องตรวจการตั้งค่า Drive"}</AlertTitle>
          <AlertDescription>
            หากยังพบ `error:no_key` ให้คัดลอก Callback URL ด้านล่างไปเพิ่มใน Google OAuth Client แล้วกด “เชื่อมใหม่”
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-4 space-y-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <p className="font-medium">Client API Key</p>
            <Badge variant={adminStatus?.clientConfigured ? "default" : "destructive"}>
              {adminStatus?.clientConfigured ? "พร้อม" : "ยังไม่ตั้งค่า"}
            </Badge>
          </div>
          <div className="rounded-lg border p-4 space-y-2">
            <Link2 className="w-5 h-5 text-primary" />
              <p className="font-medium">Connection Storage</p>
            <Badge variant={adminStatus?.connectionKeySecretConfigured ? "default" : "destructive"}>
              {adminStatus?.connectionKeySecretConfigured ? "พร้อม" : "ยังไม่ตั้งค่า"}
            </Badge>
          </div>
          <div className="rounded-lg border p-4 space-y-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <p className="font-medium">Gateway Access</p>
            <Badge variant={adminStatus?.lovableApiKeyConfigured ? "default" : "destructive"}>
              {adminStatus?.lovableApiKeyConfigured ? "พร้อม" : "ยังไม่ตั้งค่า"}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Authorized redirect URI / Callback URL</p>
            <p className="break-all text-sm text-muted-foreground">{callbackUrl}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copyCallbackUrl}>
              <Clipboard className="w-4 h-4 mr-2" /> คัดลอก URL
            </Button>
            <Button variant="outline" onClick={() => window.open("https://console.cloud.google.com/apis/credentials", "_blank")}> 
              <ExternalLink className="w-4 h-4 mr-2" /> เปิด Google Credentials
            </Button>
            <Button onClick={handleReconnect} disabled={connecting}>
              <RotateCcw className="w-4 h-4 mr-2" /> เชื่อมใหม่
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  if (!connection) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <Tabs value={currentTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="files" className="gap-2"><FolderOpen className="w-4 h-4" /> ไฟล์ของฉัน</TabsTrigger>
            {canManageDrive && <TabsTrigger value="settings" className="gap-2"><Settings className="w-4 h-4" /> ตั้งค่า Drive</TabsTrigger>}
          </TabsList>
          <TabsContent value="files" className="space-y-4">
            <ConnectionSetupCard />
          </TabsContent>
          {canManageDrive && (
            <TabsContent value="settings" className="space-y-4">
              <ConnectionSetupCard />
              <AdminSettingsCard />
            </TabsContent>
          )}
        </Tabs>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Tabs value={currentTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="files" className="gap-2"><FolderOpen className="w-4 h-4" /> ไฟล์ของฉัน</TabsTrigger>
          {canManageDrive && <TabsTrigger value="settings" className="gap-2"><Settings className="w-4 h-4" /> ตั้งค่า Drive</TabsTrigger>}
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-primary" /> Google Drive ของฉัน
                </h1>
                <p className="text-xs text-muted-foreground">
                  เชื่อมเป็น: <span className="font-medium">{connection.account_email ?? connection.account_name ?? "Google account"}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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
                          ? <FolderOpen className="w-6 h-6 text-primary shrink-0" />
                          : (f.iconLink
                              ? <img src={f.iconLink} alt="" className="w-6 h-6 shrink-0" />
                              : <FileIcon className="w-6 h-6 text-muted-foreground shrink-0" />)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">{f.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {isFolder ? "โฟลเดอร์" : formatSize(f.size)}
                            {f.modifiedTime && ` · ${new Date(f.modifiedTime).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}`}
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
        </TabsContent>

        {canManageDrive && (
          <TabsContent value="settings" className="space-y-4">
            <ConnectionSetupCard />
            <AdminSettingsCard />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
