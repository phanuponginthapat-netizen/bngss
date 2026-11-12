import { lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ScanFace, Monitor, UserPlus, Database, ShieldCheck, BarChart3, Settings, Download, Clock, ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import KioskDeviceManager from "@/components/kiosk/KioskDeviceManager";
import FailedScanQueue from "@/components/kiosk/FailedScanQueue";
import FacegateNativeSettings from "@/components/kiosk/FacegateNativeSettings";
import { useFacegateRelease } from "@/lib/facegateRelease";
const Register = lazy(() => import("@/components/facescan/FaceRegisterTab"));
const Staff = lazy(() => import("@/components/facescan/StaffFaceTab"));
const Faces = lazy(() => import("@/components/facescan/FaceDatabaseTab"));
const Approval = lazy(() => import("@/components/facescan/FaceApprovalTab"));
const Reports = lazy(() => import("@/components/facescan/FaceReportTab"));
const SchoolRules = lazy(() => import("@/components/facescan/FaceSettingsTab"));
const tabs = [
  { id: "devices", label: "เครื่องสแกน", icon: Monitor }, { id: "register", label: "ลงทะเบียน", icon: UserPlus },
  { id: "staff", label: "บุคลากร", icon: UserPlus }, { id: "faces", label: "ใบหน้า", icon: Database },
  { id: "approval", label: "อนุมัติ", icon: ShieldCheck }, { id: "reports", label: "ประวัติและรายงาน", icon: BarChart3 },
  { id: "settings", label: "ค่าของโปรแกรม", icon: Settings }, { id: "school", label: "กฎโรงเรียน", icon: Clock },
  { id: "install", label: "ติดตั้ง", icon: Download },
];
export default function FacegateAdminPage() {
  const [params, setParams] = useSearchParams();
  const selected = tabs.some(t => t.id === params.get("tab")) ? params.get("tab") || "devices" : "devices";
  const release = useFacegateRelease();
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"><div className="flex items-center gap-3"><ScanFace className="h-9 w-9 text-primary" /><div><h1 className="text-2xl font-bold">FaceGate</h1><p className="text-sm text-muted-foreground">จัดการเครื่องสแกน Windows / Linux</p></div></div><Button asChild variant="ghost"><Link to="/dashboard/student/face-scan"><ArrowLeft className="mr-2 h-4 w-4" />งานเช็คชื่อโรงเรียน</Link></Button></header>
    <Tabs value={selected} onValueChange={tab => setParams({ tab }, { replace: true })} className="grid min-w-0 gap-5 lg:grid-cols-[200px_minmax(0,1fr)]" orientation="vertical">
      <TabsList aria-label="เมนู FaceGate" className="h-fit w-full lg:flex-col lg:items-stretch lg:bg-transparent lg:p-0">{tabs.map(t => <TabsTrigger key={t.id} value={t.id} className="justify-start gap-2 lg:w-full"><t.icon className="h-4 w-4" />{t.label}</TabsTrigger>)}</TabsList>
      <Suspense fallback={<p className="text-muted-foreground">กำลังโหลด…</p>}>
        <TabsContent value="devices" className="mt-0 min-w-0 space-y-5"><KioskDeviceManager /><FailedScanQueue /></TabsContent>
        <TabsContent value="register" className="mt-0"><Register /></TabsContent><TabsContent value="staff" className="mt-0"><Staff /></TabsContent>
        <TabsContent value="faces" className="mt-0"><Faces /></TabsContent><TabsContent value="approval" className="mt-0"><Approval /></TabsContent>
        <TabsContent value="reports" className="mt-0 min-w-0"><Reports /></TabsContent><TabsContent value="settings" className="mt-0"><FacegateNativeSettings /></TabsContent>
        <TabsContent value="school" className="mt-0"><SchoolRules /></TabsContent>
        <TabsContent value="install" className="mt-0 space-y-5"><h2 className="text-lg font-semibold">ติดตั้ง FaceGate</h2><div className="flex flex-wrap gap-3"><Button asChild><a href={release.url} download={release.fileName}><Download className="mr-2 h-4 w-4" />{release.isExe ? "Windows — FaceGateSetup.exe" : "ชุดติดตั้ง FaceGate"}</a></Button><Button asChild variant="outline"><Link to="/dashboard/admin/kiosk-setup">ติดตั้ง Linux</Link></Button></div>{release.version && <p className="text-sm text-muted-foreground">รุ่นที่เผยแพร่ {release.version}</p>}<Button asChild variant="outline"><Link to="?tab=devices">สร้างรหัสเครื่อง</Link></Button></TabsContent>
      </Suspense>
    </Tabs>
  </div>;
}