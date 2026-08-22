import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportDMC, exportSGS } from "@/lib/obecExport";
import { exportSchoolMisExcel } from "@/lib/schoolMisExport";

export default function ObecHubPage(){
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">OBEC Hub — เชื่อม สพฐ. ไร้รอยต่อ</h1>
      <p className="text-sm text-muted-foreground">ส่งออก DMC / SGS / SchoolMIS / ปพ. + ยิง API สพฐ. อัตโนมัติเมื่อเขตเปิดให้</p>
      <div className="grid grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle>DMC</CardTitle></CardHeader><CardContent><Button onClick={()=> exportDMC([])}>Export DMC</Button></CardContent></Card>
        <Card><CardHeader><CardTitle>SGS</CardTitle></CardHeader><CardContent><Button onClick={()=> exportSGS([])}>Export SGS</Button></CardContent></Card>
        <Card><CardHeader><CardTitle>SchoolMIS</CardTitle></CardHeader><CardContent><Button onClick={()=> exportSchoolMisExcel([])}>Export SchoolMIS</Button></CardContent></Card>
        <Card><CardHeader><CardTitle>ปพ.5</CardTitle></CardHeader><CardContent><Button variant="outline">พิมพ์ ปพ.1-6 (ดู /preview-gov)</Button></CardContent></Card>
      </div>
      <Card className="border-dashed"><CardContent className="pt-6 text-xs text-muted-foreground">API auto-push จะใส่ endpoint สพฐ. (DMC API / SFTP) เมื่อ สพป. แจ้ง — ตอนนี้กด Export แล้วอัปโหลดพอร์ทัล สพฐ. ได้ทันที</CardContent></Card>
    </div>
  );
}
