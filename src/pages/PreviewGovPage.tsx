import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportSchoolMisExcel, printPor5, printLunchReport, printHomeroomReport } from "@/lib/schoolMisExport";
import { printHomeVisitNRS01 } from "@/lib/printHomeVisitNRS01";

const sampleRows = [
  { schoolCode:"10420101", year:"2568", term:"1", subjectCode:"ค21101", subjectName:"คณิตศาสตร์1", credit:1.5, studentCode:"12345", studentName:"เด็กชาย ทดสอบ หนึ่ง", fullScore:100, score:82 },
  { schoolCode:"10420101", year:"2568", term:"1", subjectCode:"ค21101", subjectName:"คณิตศาสตร์1", credit:1.5, studentCode:"12346", studentName:"เด็กหญิง ทดสอบ สอง", fullScore:100, score:67 },
  { schoolCode:"10420101", year:"2568", term:"1", subjectCode:"ค21101", subjectName:"คณิตศาสตร์1", credit:1.5, studentCode:"12347", studentName:"เด็กชาย ทดสอบ สาม", fullScore:100, score:45 },
];

export default function PreviewGovPage(){
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6 space-y-6 max-w-5xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-r from-primary via-primary to-accent p-[1px] shadow-xl">
        <div className="rounded-3xl bg-white p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xl shadow-lg">🏫</div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{fontFamily:"Kanit"}}>Preview ฟอร์มราชการ — BNGSS</h1>
            <p className="text-sm text-muted-foreground">ดูตัวอย่าง Export SchoolMIS + พิมพ์ ปพ.5 / อาหารกลางวัน / โฮมรูม / นร./กสศ.01 — แบบเดียวกับกระดาษราชการ</p>
          </div>
          <div className="ml-auto hidden sm:block text-xs text-muted-foreground border rounded-full px-3 py-1 bg-muted/50">TH Sarabun New 16pt · A4 25/20/20/30</div>
        </div>
      </div>

      <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-all border-primary/10">
        <CardHeader><CardTitle className="flex items-center gap-2">📊 1. เกรด — SchoolMIS Excel + ปพ.5</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr><th className="p-2">เลขประจำตัว</th><th>ชื่อ</th><th>เต็ม</th><th>ได้</th><th>เกรด</th></tr></thead>
              <tbody>{sampleRows.map(r=> <tr key={r.studentCode} className="border-t"><td className="p-2 text-center">{r.studentCode}</td><td className="p-2">{r.studentName}</td><td className="p-2 text-center">{r.fullScore}</td><td className="p-2 text-center">{r.score}</td><td className="p-2 text-center font-bold">{r.score>=80?"4":r.score>=65?"2.5":"0"}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button className="bg-gradient-to-r from-primary to-accent text-white shadow-md hover:shadow-lg transition-all" onClick={()=> exportSchoolMisExcel(sampleRows)}>Export SchoolMIS .xlsx</Button>
            <Button variant="outline" className="border-primary/20 hover:bg-primary/5" onClick={()=> printPor5(sampleRows, { schoolName:"โรงเรียนบ้านหนองเงือก", term:"1", year:"2568", subjectCode:"ค21101", subjectName:"คณิตศาสตร์1"})}>พิมพ์ ปพ.5</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-all border-primary/10">
        <CardHeader><CardTitle className="flex items-center gap-2">🍱 2. อาหารกลางวัน — รายงาน สพฐ.</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm border rounded p-3 bg-muted/30">ตัวอย่าง: 2026-08-20 ข้าวไก่กระเพรา + ไข่ดาว | 120 คน | งบ 22 บาท | สพฐ.</div>
          <Button variant="outline" onClick={()=> printLunchReport([{date:"2026-08-20", menu:"ข้าวไก่กระเพรา + ไข่ดาว (5 หมู่)", students:120, budgetPerHead:22, source:"สพฐ."},{date:"2026-08-21", menu:"ข้าวหมูทอด + ต้มจืด", students:118, budgetPerHead:22, source:"อบต."}])}>พิมพ์รายงานอาหารกลางวัน</Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-all border-primary/10">
        <CardHeader><CardTitle className="flex items-center gap-2">🏠 3. โฮมรูม 5 หมวด — สพฐ. ระบบดูแลช่วยเหลือนักเรียน</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm border rounded p-3 bg-muted/30">เยี่ยมบ้าน / SDQ / ทุน / พฤติกรรม / EO — ตัวอย่างห้อง 6/1</div>
          <Button variant="outline" onClick={()=> printHomeroomReport([{studentCode:"12345", name:"เด็กชาย หนึ่ง", visit:"ผ่าน", sdq:"ปกติ", scholarship:"ไม่มี", behavior:"ดี", eo:"ปกติ"},{studentCode:"12346", name:"เด็กหญิง สอง", visit:"รอเยี่ยม", sdq:"เสี่ยง", scholarship:"ทุนยากจน", behavior:"ดีมาก", eo:"ปกติ"}], {classroom:"6/1", term:"1", year:"2568"})}>พิมพ์รายงานโฮมรูม</Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-all border-primary/10">
        <CardHeader><CardTitle className="flex items-center gap-2">🏡 4. เยี่ยมบ้าน — แบบ นร./กสศ.01 (กสศ. ฉบับ มี.ค. 2567)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm border rounded p-3 bg-muted/30">ฟอร์ม 3 หน้า: ข้อมูลนักเรียน / สมาชิกครัวเรือน / ลักษณะที่อยู่ / ที่ดิน / น้ำ/ไฟ / รูปนอก-ใน + ลายเซ็น</div>
          <Button onClick={()=> printHomeVisitNRS01({ term:"1", year:"2568", schoolName:"โรงเรียนบ้านหนองเงือก", affiliation:"สพป.เชียงใหม่ เขต 1", student:{prefix:"ด.ช.", firstName:"ทดสอบ", lastName:"หนึ่ง", classroom:"ป.6/1", citizenId:"1-5001-00001-01-1", familyStatus:"พ่อแม่อยู่ด้วยกัน", liveWith:"พ่อ/แม่", guardianName:"สมชาย หนึ่ง", guardianRelation:"บิดา", guardianEducation:"ป.6", guardianJob:"รับจ้าง", guardianPhone:"0812345678", welfare:true}, householdCount:4, members:[{name:"เด็กชาย ทดสอบ หนึ่ง", relation:"นักเรียน", citizenId:"1-5001-00001-01-1"},{name:"นาย สมชาย หนึ่ง", relation:"บิดา", citizenId:"3-5001-00002-01-1"}], housing:{type:"บ้านตนเอง", floor:"ไม้กระดาน", wall:"ไม้กระดาน", roof:"สังกะสี", toilet:"มี", land:"ไม่มีที่ดิน", water:"น้ำประปา", electricity:"ไฟฟ้า"}, address:{no:"123", moo:"5", tambon:"หนองเงือก", amphoe:"เมือง", province:"เชียงใหม่", zip:"50000"}, photos:{}})}>พิมพ์ นร./กสศ.01</Button>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-6 text-xs text-muted-foreground">
          วิธีใช้จริง: ในหน้า <code>TestScoresPage / SchoolLunchPage / HomeroomPage</code> เรียก <code>import {"{ exportSchoolMisExcel, printPor5 }"} from "@/lib/schoolMisExport"</code> แล้วผูกปุ่มได้ทันที — ไฟล์นี้เป็นหน้า Preview ชั่วคราวที่ <code>/preview-gov</code>
        </CardContent>
      </Card>
    </div>
  );
}
