import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanFace, UserPlus, Database, BarChart3, Settings, ShieldCheck, Loader2 } from "lucide-react";
import FaceScanTab from "@/components/facescan/FaceScanTab";
import FaceRegisterTab from "@/components/facescan/FaceRegisterTab";
import FaceDatabaseTab from "@/components/facescan/FaceDatabaseTab";
import FaceReportTab from "@/components/facescan/FaceReportTab";
import FaceSettingsTab from "@/components/facescan/FaceSettingsTab";
import FaceApprovalTab from "@/components/facescan/FaceApprovalTab";
import { useUserRole } from "@/hooks/useUserRole";
import { ShieldAlert } from "lucide-react";

const FaceScanPage = () => {
  const { isAdmin, isDirector, isTeacher, isStudent, loading } = useUserRole();
  const canManage = isAdmin || isDirector;
  const canScan = canManage || isTeacher;
  const [tab, setTab] = useState(isStudent ? "self" : "scan");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // นักเรียน: เห็นเฉพาะ "ลงทะเบียนใบหน้าของฉัน" + รายงานของตัวเอง
  if (isStudent) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
            <ScanFace className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ลงทะเบียนใบหน้าของฉัน</h1>
            <p className="text-sm text-muted-foreground">ถ่ายรูปใบหน้าตัวเองแล้วส่งให้แอดมินอนุมัติ เพื่อใช้สแกนเข้าโรงเรียน</p>
          </div>
        </div>
        <FaceRegisterTab />
      </div>
    );
  }

  if (!canScan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
        <ShieldAlert className="h-14 w-14 text-amber-500" />
        <div>
          <h2 className="text-xl font-semibold mb-1">ไม่มีสิทธิ์ใช้งานสแกนเข้าโรงเรียน</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            ฟังก์ชันนี้สำหรับครูเวร ผู้ดูแลระบบ และผู้อำนวยการเท่านั้น
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
          <ScanFace className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">สแกน QR เข้าโรงเรียน</h1>
          <p className="text-sm text-muted-foreground">ครูเวรสแกน QR ของนักเรียนที่หน้าประตู — ประหยัดแบตมือถือ · การสแกนใบหน้าใช้ "โหมดคีออส" ที่แทปเลตประจำจุด</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="w-full overflow-x-auto">
          <TabsList className={`inline-flex h-auto w-auto min-w-full sm:grid ${canManage ? "sm:grid-cols-6" : "sm:grid-cols-3"} sm:max-w-4xl gap-1`}>
            <TabsTrigger value="scan" className="gap-2 whitespace-nowrap"><ScanFace className="w-4 h-4" /><span>สแกน</span></TabsTrigger>
            <TabsTrigger value="register" className="gap-2 whitespace-nowrap"><UserPlus className="w-4 h-4" /><span>ลงทะเบียน</span></TabsTrigger>
            {canManage && <TabsTrigger value="approval" className="gap-2 whitespace-nowrap"><ShieldCheck className="w-4 h-4" /><span>อนุมัติ</span></TabsTrigger>}
            {canManage && <TabsTrigger value="database" className="gap-2 whitespace-nowrap"><Database className="w-4 h-4" /><span>ฐานข้อมูล</span></TabsTrigger>}
            <TabsTrigger value="report" className="gap-2 whitespace-nowrap"><BarChart3 className="w-4 h-4" /><span>รายงาน</span></TabsTrigger>
            {canManage && <TabsTrigger value="settings" className="gap-2 whitespace-nowrap"><Settings className="w-4 h-4" /><span>ตั้งค่า</span></TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="scan" className="mt-4"><FaceScanTab /></TabsContent>
        <TabsContent value="register" className="mt-4"><FaceRegisterTab /></TabsContent>
        {canManage && <TabsContent value="approval" className="mt-4"><FaceApprovalTab /></TabsContent>}
        {canManage && <TabsContent value="database" className="mt-4"><FaceDatabaseTab /></TabsContent>}
        <TabsContent value="report" className="mt-4"><FaceReportTab /></TabsContent>
        {canManage && <TabsContent value="settings" className="mt-4"><FaceSettingsTab /></TabsContent>}

      </Tabs>
    </div>
  );
};

export default FaceScanPage;
