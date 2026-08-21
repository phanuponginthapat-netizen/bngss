import { openPrintWindow } from "./printUtils";

export interface NRS01Data {
  term: string; year: string; schoolName: string; affiliation: string;
  student: { prefix: string; firstName: string; lastName: string; classroom: string; citizenId: string; familyStatus: string; liveWith: string; guardianName: string; guardianRelation: string; guardianEducation: string; guardianJob: string; guardianPhone: string; welfare: boolean };
  householdCount: number;
  members: { name: string; relation: string; citizenId: string; age?: string; job?: string }[];
  housing: { type: string; rent?: string; floor: string; wall: string; roof: string; toilet: string; land: string; water: string; electricity: string };
  address: { no: string; moo: string; tambon: string; amphoe: string; province: string; zip: string };
  photos: { outside?: string; inside?: string };
}

export function printHomeVisitNRS01(d: NRS01Data){
  const html = `
  <div style="font-family:TH Sarabun New, sans-serif; padding:12pt 18pt; font-size:11pt; line-height:1.35; color:#000">
    <div style="text-align:center; border-bottom:3px double #000; padding-bottom:6pt; margin-bottom:8pt">
      <div style="font-size:16pt; font-weight:bold">แบบ นร./กสศ.01 ฉบับปรับปรุง มีนาคม 2567</div>
      <div style="font-size:13pt; font-weight:bold">แบบขอรับเงินอุดหนุนนักเรียนยากจน ภาคเรียนที่ ${d.term} ปีการศึกษา ${d.year}</div>
      <div style="font-size:10pt">${d.schoolName} สังกัด ${d.affiliation}</div>
    </div>

    <div style="font-weight:bold; background:#f0f0f0; padding:3pt 6pt; border:1px solid #999">1. ข้อมูลนักเรียน</div>
    <table style="width:100%; border-collapse:collapse; font-size:10pt; margin-bottom:6pt" border="1" cellpadding="3">
      <tr><td width="35%">ชื่อ ${d.student.prefix} ${d.student.firstName} นามสกุล ${d.student.lastName}</td><td>ชั้น ${d.student.classroom}</td><td>เลขประจำตัวประชาชน ${d.student.citizenId}</td></tr>
      <tr><td colspan="3">สถานภาพครอบครัว: ${d.student.familyStatus} | อาศัยอยู่กับ: ${d.student.liveWith}</td></tr>
      <tr><td>ชื่อผู้ปกครอง ${d.student.guardianName}</td><td>ความสัมพันธ์ ${d.student.guardianRelation}</td><td>โทร ${d.student.guardianPhone} | สวัสดิการแห่งรัฐ: ${d.student.welfare?"ได้":"ไม่ได้"}</td></tr>
      <tr><td>การศึกษาสูงสุด ${d.student.guardianEducation}</td><td colspan="2">อาชีพ ${d.student.guardianJob}</td></tr>
    </table>

    <div style="font-weight:bold; background:#f0f0f0; padding:3pt 6pt; border:1px solid #999">2. จำนวนสมาชิกในครัวเรือน (รวมนักเรียน) ${d.householdCount} คน</div>
    <table style="width:100%; border-collapse:collapse; font-size:9pt; margin-bottom:6pt" border="1" cellpadding="2">
      <tr style="background:#eee; text-align:center; font-weight:bold"><td>ที่</td><td>ชื่อ-สกุล</td><td>ความสัมพันธ์</td><td>เลขประจำตัว</td></tr>
      ${d.members.map((m,i)=>`<tr><td style="text-align:center">${i+1}</td><td>${m.name}</td><td>${m.relation}</td><td>${m.citizenId}</td></tr>`).join("")}
    </table>

    <div style="font-weight:bold; background:#f0f0f0; padding:3pt 6pt; border:1px solid #999">3. ลักษณะที่อยู่อาศัย</div>
    <table style="width:100%; border-collapse:collapse; font-size:9pt; margin-bottom:6pt" border="1" cellpadding="2">
      <tr><td>ประเภท: ${d.housing.type} ${d.housing.rent?`ค่าเช่า ${d.housing.rent} บาท/เดือน`:``}</td><td>พื้น: ${d.housing.floor}</td><td>ฝา: ${d.housing.wall}</td></tr>
      <tr><td>หลังคา: ${d.housing.roof}</td><td>ส้วม: ${d.housing.toilet}</td><td>ที่ดิน: ${d.housing.land}</td></tr>
      <tr><td>น้ำดื่ม: ${d.housing.water}</td><td colspan="2">ไฟฟ้า: ${d.housing.electricity}</td></tr>
    </table>

    <div style="font-weight:bold; background:#f0f0f0; padding:3pt 6pt; border:1px solid #999">4. ที่ตั้งที่พักอาศัย</div>
    <div style="font-size:9pt; border:1px solid #999; padding:4pt; margin-bottom:6pt">บ้านเลขที่ ${d.address.no} หมู่ ${d.address.moo} ตำบล ${d.address.tambon} อำเภอ ${d.address.amphoe} จังหวัด ${d.address.province} ${d.address.zip}</div>

    <div style="font-weight:bold; background:#f0f0f0; padding:3pt 6pt; border:1px solid #999">7. ภาพถ่ายที่พักอาศัย</div>
    <div style="display:flex; gap:8pt; margin:6pt 0">
      <div style="flex:1; border:1px solid #999; height:160pt; display:flex; align-items:center; justify-content:center; background:#fafafa">${d.photos.outside?`<img src="${d.photos.outside}" style="max-width:100%; max-height:100%">`:"รูปที่ 1 นอกที่พัก"}</div>
      <div style="flex:1; border:1px solid #999; height:160pt; display:flex; align-items:center; justify-content:center; background:#fafafa">${d.photos.inside?`<img src="${d.photos.inside}" style="max-width:100%; max-height:100%">`:"รูปที่ 2 ภายในที่พัก"}</div>
    </div>
    <div style="font-size:8pt; color:#666; text-align:center">กรุณาถ่ายให้เห็นหลังคาและฝาผนังทั้งหลัง / พื้นและภายใน</div>

    <div style="margin-top:14pt; display:flex; justify-content:space-between; font-size:9pt; text-align:center">
      <div>ข้าพเจ้าขอรับรองว่าข้อมูลถูกต้อง<br><br>ลงชื่อ...........................ผู้ปกครอง<br>(...........................)</div>
      <div>ครูผู้เยี่ยมบ้าน<br><br>ลงชื่อ...........................<br>(...........................)</div>
    </div>
    <div style="text-align:center; margin-top:8pt; font-size:7pt; color:#888">แบบ นร./กสศ.01 — กองทุนเพื่อความเสมอภาคทางการศึกษา (กสศ.) 388 อาคาร เอส.พี. ชั้น 13 ถนนพหลโยธิน โทร 02-079-5475</div>
  </div>`;
  openPrintWindow(html, { title: "นร.กสศ.01" });
}
