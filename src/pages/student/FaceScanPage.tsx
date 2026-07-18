import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, ScanFace, UserPlus, Database, BarChart3, Settings, ShieldCheck, Monitor, BatteryFull, Zap } from "lucide-react";
import FaceScanTab from "@/components/facescan/FaceScanTab";
import FaceRegisterTab from "@/components/facescan/FaceRegisterTab";
import FaceDatabaseTab from "@/components/facescan/FaceDatabaseTab";
import FaceReportTab from "@/components/facescan/FaceReportTab";
import FaceSettingsTab from "@/components/facescan/FaceSettingsTab";
import FaceApprovalTab from "@/components/facescan/FaceApprovalTab";
import { useUserRole } from "@/hooks/useUserRole";

const FaceScanPage = () => {
  const { isAdmin, isDirector } = useUserRole();
  const canManage = isAdmin || isDirector;
  const [tab, setTab] = useState("qr");

  const openKiosk = () => window.open("/face-kiosk", "_blank");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
          <QrCode className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">สแกนเข้าโรงเรียน</h1>
          <p className="text-sm text-muted-foreground">
            ครูใช้ <b>สแกน QR</b> ที่ประตู (ประหยัดแบต) — <b>สแกนใบหน้า</b> ใช้เฉพาะโหมดคีออส (แทปเลตตั้งโต๊ะ)
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="w-full overflow-x-auto">
          <TabsList className={`inline-flex h-auto w-auto min-w-full sm:grid ${canManage ? "sm:grid-cols-7" : "sm:grid-cols-4"} sm:max-w-5xl gap-1`}>
            <TabsTrigger value="qr" className="gap-2 whitespace-nowrap">
              <QrCode className="w-4 h-4" /><span>สแกน QR</span>
              <BatteryFull className="w-3 h-3 text-emerald-500" />
            </TabsTrigger>
            <TabsTrigger value="face" className="gap-2 whitespace-nowrap">
              <ScanFace className="w-4 h-4" /><span>สแกนใบหน้า</span>
            </TabsTrigger>
            <TabsTrigger value="register" className="gap-2 whitespace-nowrap"><UserPlus className="w-4 h-4" /><span>ลงทะเบียน</span></TabsTrigger>
            {canManage && <TabsTrigger value="approval" className="gap-2 whitespace-nowrap"><ShieldCheck className="w-4 h-4" /><span>อนุมัติ</span></TabsTrigger>}
            {canManage && <TabsTrigger value="database" className="gap-2 whitespace-nowrap"><Database className="w-4 h-4" /><span>ฐานข้อมูล</span></TabsTrigger>}
            <TabsTrigger value="report" className="gap-2 whitespace-nowrap"><BarChart3 className="w-4 h-4" /><span>รายงาน</span></TabsTrigger>
            {canManage && <TabsTrigger value="settings" className="gap-2 whitespace-nowrap"><Settings className="w-4 h-4" /><span>ตั้งค่า</span></TabsTrigger>}
          </TabsList>
        </div>

        {/* สแกน QR — น้ำหนักเบา ไม่โหลดโมเดล AI */}
        <TabsContent value="qr" className="mt-4">
          <FaceScanTab mode="qr" />
        </TabsContent>

        {/* สแกนใบหน้า — บอกให้ใช้โหมดคีออสแทน */}
        <TabsContent value="face" className="mt-4">
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
                <Monitor className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold">การสแกนใบหน้าใช้เฉพาะโหมดคีออส</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  เพื่อรักษาแบตเตอรี่ของเครื่องครู — โหมดสแกนใบหน้า (AI 28 MB + inference ทุกเฟรม)
                  ถูกจำกัดให้ใช้บน <b>แทปเลตตั้งโต๊ะ/คีออส</b> ที่เสียบชาร์จตลอดเวลาเท่านั้น
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-center text-xs text-muted-foreground bg-white/60 dark:bg-white/5 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> ประหยัดแบต ~50–70% เทียบกับโหมดใบหน้า</div>
                <span className="hidden sm:inline">•</span>
                <div className="flex items-center gap-2"><BatteryFull className="w-4 h-4 text-emerald-500" /> ไม่โหลด AI model, ไม่รัน inference</div>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                <Button onClick={openKiosk} className="gradient-primary gap-2">
                  <Monitor className="w-4 h-4" />เปิดโหมดคีออส (หน้าต่างใหม่)
                </Button>
                <Button variant="outline" onClick={() => setTab("qr")} className="gap-2">
                  <QrCode className="w-4 h-4" />ใช้สแกน QR แทน
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
