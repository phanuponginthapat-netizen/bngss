import { openPrintWindow, currentThaiDate } from "@/lib/printUtils";
import { resolveStorageUrl } from "@/lib/storageUrl";

// -------- helpers --------
const CB_ON = "☑";
const CB_OFF = "☐";
const cb = (checked: boolean, label: string) =>
  `<span style="margin-right:12px;white-space:nowrap;">${checked ? CB_ON : CB_OFF} ${label}</span>`;
const has = (arr: any, v: string) => Array.isArray(arr) && arr.includes(v);
const dash = (v: any) => (v === null || v === undefined || v === "" ? "………………………………" : String(v));
const thaiDate = (d?: string) => {
  if (!d) return currentThaiDate();
  try {
    const dt = new Date(d);
    const be = dt.getFullYear() + 543;
    const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    return `${dt.getDate()} ${months[dt.getMonth()]} ${be}`;
  } catch { return d; }
};

export interface HomeVisitKssData {
  record: any;
  student: { prefix?: string; first_name?: string; last_name?: string; student_code?: string; national_id?: string; classroom_name?: string };
  school: {
    school_name: string;
    school_address?: string;
    school_logo?: string;
    director_name?: string;
    director_signature_url?: string;
  };
  academic_year?: number; // BE
  semester?: number;
}

export async function printHomeVisitKss01(data: HomeVisitKssData) {
  const { record: r, student, school } = data;
  const beYear = data.academic_year || (r.academic_year ? r.academic_year + 543 : new Date().getFullYear() + 543);
  const semester = data.semester || r.semester || 1;
  const status = r.household_status || {};
  const members: any[] = Array.isArray(r.household_members) ? r.household_members : [];

  const photos: string[] = r.photo_urls?.length
    ? await Promise.all(r.photo_urls.map((p: string) => resolveStorageUrl("home-visit-photos", p)))
    : [];

  const fullName = `${student.prefix || ""}${student.first_name || ""} ${student.last_name || ""}`.trim();

  const html = `
  <style>
    .kss { font-family:'TH Sarabun New',serif; font-size:14pt; color:#000; }
    .kss h1 { text-align:center; font-size:18pt; margin:0; }
    .kss .sub { text-align:center; font-size:14pt; margin:2pt 0 12pt; }
    .kss .sec { font-weight:700; background:#eee; padding:4pt 8pt; margin:10pt 0 6pt; border-left:3px solid #333; }
    .kss .row { margin:3pt 0; }
    .kss table { width:100%; border-collapse:collapse; margin-top:4pt; }
    .kss table td, .kss table th { border:1px solid #333; padding:3pt 5pt; font-size:13pt; vertical-align:top; }
    .kss .cb-group { line-height:1.9; }
    .kss .sig-grid { display:grid; grid-template-columns:1fr 1fr; gap:24pt; margin-top:28pt; text-align:center; }
    .kss .sig-line { border-top:1px dotted #000; padding-top:2pt; margin:32pt 12pt 0; }
    .kss .photo-grid { display:grid; grid-template-columns:1fr 1fr; gap:8pt; margin-top:6pt; }
    .kss .photo-grid img { width:100%; height:180pt; object-fit:cover; border:1px solid #333; }
    .kss .header-logo { text-align:center; margin-bottom:6pt; }
    .kss .header-logo img { height:56pt; }
    .kss .footer-note { font-size:11pt; color:#333; margin-top:8pt; }
    @media print { .kss .sec { break-after: avoid; } .kss .photo-grid { break-inside: avoid; } }
  </style>
  <div class="kss">
    <div class="header-logo">
      ${school.school_logo ? `<img src="${school.school_logo}" alt="logo"/>` : ""}
    </div>
    <h1>แบบบันทึกการเยี่ยมบ้าน (แบบ นร./กสศ.01)</h1>
    <div class="sub">
      ภาคเรียนที่ ${semester} ปีการศึกษา ${beYear}<br/>
      โรงเรียน ${school.school_name}${school.school_address ? ` — ${school.school_address}` : ""}
    </div>

    <div class="sec">1. ข้อมูลนักเรียน</div>
    <div class="row">ชื่อนักเรียน <b>${student.first_name || ""}</b> &nbsp; นามสกุล <b>${student.last_name || ""}</b> &nbsp; ชั้น <b>${student.classroom_name || "-"}</b></div>
    <div class="row">เลขประจำตัวประชาชน/เลขรหัส <b>${dash(student.national_id || student.student_code)}</b></div>
    <div class="row cb-group">สถานภาพครอบครัว
      ${cb(r.family_marital_status === "together", "พ่อแม่อยู่ด้วยกัน")}
      ${cb(r.family_marital_status === "separated", "พ่อแม่แยกกันอยู่")}
      ${cb(r.family_marital_status === "divorced", "พ่อแม่หย่าร้าง")}
      ${cb(r.family_marital_status === "father_deceased", "พ่อเสียชีวิต/สาบสูญ")}
      ${cb(r.family_marital_status === "mother_deceased", "แม่เสียชีวิต/สาบสูญ")}
      ${cb(r.family_marital_status === "both_deceased", "เสียชีวิตทั้งคู่/สาบสูญ")}
      ${cb(r.family_marital_status === "abandoned", "พ่อ/แม่ทอดทิ้ง")}
    </div>
    <div class="row cb-group">นักเรียนอาศัยอยู่กับ
      ${cb(r.living_with?.includes("พ่อ") || r.living_with?.includes("แม่") || r.living_with === "parents", "พ่อ/แม่")}
      ${cb(r.living_with === "relatives" || r.living_with?.includes("ญาติ"), "ญาติ")}
      ${cb(r.living_with === "alone", "อยู่ลำพัง")}
      ${cb(r.living_with === "guardian", "ผู้อุปการะ/นายจ้าง")}
      ${cb(r.living_with === "institution", "ครัวเรือนสถาบัน")}
    </div>
    <div class="row">ชื่อผู้ปกครอง <b>${dash(`${r.guardian_prefix || ""}${r.guardian_first_name || ""}`)}</b>
      นามสกุล <b>${dash(r.guardian_last_name)}</b> ความสัมพันธ์ <b>${dash(r.guardian_relation)}</b></div>
    <div class="row">การศึกษาสูงสุด <b>${dash(r.guardian_education)}</b> อาชีพ <b>${dash(r.guardian_occupation)}</b> โทร <b>${dash(r.guardian_phone)}</b></div>
    <div class="row">เลขประจำตัวประชาชนผู้ปกครอง <b>${dash(r.guardian_id_card)}</b> ${cb(!!r.guardian_no_id_card, "ไม่มีเลขประจำตัวประชาชน")}</div>
    <div class="row">${cb(!!r.has_state_welfare, "ได้สวัสดิการแห่งรัฐ (ทะเบียนคนจน)")}</div>

    <div class="sec">2. จำนวนสมาชิกในครัวเรือน (รวมตัวนักเรียน) รวม ${r.num_family_members || members.length || 0} คน</div>
    ${members.length ? `
      <table><thead><tr>
        <th>ลำดับ</th><th>ชื่อ-สกุล</th><th>ความสัมพันธ์</th><th>อายุ</th><th>อาชีพ</th><th>รายได้/เดือน</th>
      </tr></thead><tbody>
        ${members.map((m, i) => `<tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${m.prefix || ""}${m.first_name || ""} ${m.last_name || ""}</td>
          <td>${m.relation || "-"}</td>
          <td style="text-align:center">${m.age ?? "-"}</td>
          <td>${m.occupation || "-"}</td>
          <td style="text-align:right">${m.income ? Number(m.income).toLocaleString() : "-"}</td>
        </tr>`).join("")}
      </tbody></table>` : `<div class="row">— ไม่มีข้อมูลสมาชิกในครัวเรือน —</div>`}

    <div class="sec">3. ข้อมูลสถานะของครัวเรือน</div>
    <div class="row cb-group">3.1 ภาระพึ่งพิง
      ${cb(!status.dependency?.length, "ไม่มีภาระพึ่งพิง")}
      ${cb(!!status.dependency?.length, "มีภาระพึ่งพิง")}
      <br/>
      ${cb(has(status.dependency, "disability"), "มีความพิการทางร่างกาย/สติปัญญา")}
      ${cb(has(status.dependency, "chronic"), "มีโรคเรื้อรัง (ยกเว้นความดัน/เบาหวาน)")}
      ${cb(has(status.dependency, "elderly"), "ผู้สูงอายุตั้งแต่ 60 ปีขึ้นไป")}
      ${cb(has(status.dependency, "single_parent"), "เป็นพ่อ/แม่เลี้ยงเดี่ยว")}
      ${cb(has(status.dependency, "unemployed"), "คนอายุ 15-65 ปีที่ว่างงาน")}
    </div>
    <div class="row cb-group">3.2 การอยู่อาศัย
      ${cb(status.living === "own", "อยู่บ้านตนเอง/เจ้าของบ้าน")}
      ${cb(status.living === "rent", "อยู่บ้านเช่า")}
      ${cb(status.living === "free", "อยู่กับผู้อื่น/อยู่ฟรี")}
      ${cb(status.living === "dorm", "หอพัก")}
    </div>
    <div class="row cb-group">3.3 วัสดุพื้นบ้าน
      ${["กระเบื้อง/เซรามิค","ปาเก้/ไม้ขัดเงา","ซีเมนต์เปลือย","ไม้กระดาน","ไวนิล/กระเบื้องยาง/เสื่อน้ำมัน","ไม้ไผ่","ดิน/ทราย","อื่นๆ"].map(v => cb(has(status.floor_material, v), v)).join("")}
      <br/>วัสดุฝาบ้าน
      ${["ฉาบซีเมนต์","อิฐ/ก้อนปูน/อิฐบล็อก","สังกะสี","ไม้กระดาน","ไม้อัด","สมาร์ทบอร์ด/ไฟเบอร์","ไม้ไผ่/เศษไม้","ดิน/ไวนิล/อื่นๆ"].map(v => cb(has(status.wall_material, v), v)).join("")}
      <br/>วัสดุหลังคา
      ${["โลหะ (สังกะสี/เหล็ก)","กระเบื้อง/เซรามิค","ไม้กระดาน","ใบไม้/วัสดุธรรมชาติ","ไวนิล/พลาสติก","อื่นๆ"].map(v => cb(has(status.roof_material, v), v)).join("")}
      <br/>ห้องส้วมในที่อยู่อาศัย ${cb(!!status.has_toilet, "มี")} ${cb(status.has_toilet === false, "ไม่มี")}
    </div>
    <div class="row cb-group">3.4 ที่ดินทำการเกษตร
      ${cb(status.farm_land === "none", "ไม่ทำเกษตร")}
      ${cb(status.farm_land === "lt1", "น้อยกว่า 1 ไร่")}
      ${cb(status.farm_land === "1to5", "1 ถึง 5 ไร่")}
      ${cb(status.farm_land === "gt5", "มากกว่า 5 ไร่")}
    </div>
    <div class="row cb-group">3.5 แหล่งน้ำดื่ม
      ${["น้ำดื่มบรรจุขวด/ตู้หยอด","น้ำประปา","น้ำบ่อ/บาดาล","น้ำฝน/ลำธาร"].map(v => cb(has(status.water_source, v), v)).join("")}
    </div>
    <div class="row cb-group">3.6 แหล่งไฟฟ้า
      ${cb(has(status.electricity_source, "none"), "ไม่มีไฟฟ้า")}
      ${["เครื่องปั่นไฟ/โซลาเซลล์","ไฟต่อพ่วง/แบตเตอรี่","ไฟบ้าน/มิเตอร์"].map(v => cb(has(status.electricity_source, v), v)).join("")}
    </div>
    <div class="row cb-group">3.7 ยานพาหนะ
      ${cb(has(status.vehicles, "none"), "ไม่มียานพาหนะ")}
      ${["รถยนต์ (เกิน15ปี)","รถยนต์ (ไม่เกิน15ปี)","ปิกอัพ (เกิน15ปี)","ปิกอัพ (ไม่เกิน15ปี)","รถไถ (เกิน15ปี)","รถไถ (ไม่เกิน15ปี)","มอเตอร์ไซค์/เรือเล็ก"].map(v => cb(has(status.vehicles, v), v)).join("")}
    </div>
    <div class="row cb-group">3.8 ของใช้ในครัวเรือน
      ${cb(has(status.household_items, "none"), "ไม่มี")}
      ${["คอมพิวเตอร์","แอร์","ทีวีจอแบน","เครื่องซักผ้า","ตู้เย็น"].map(v => cb(has(status.household_items, v), v)).join("")}
    </div>

    <div class="sec">4. รายได้ครัวเรือน</div>
    <div class="row">รายได้เฉลี่ย/เดือน <b>${r.income_per_month ? Number(r.income_per_month).toLocaleString() : "-"}</b> บาท &nbsp; สถานะยากจน: <b>${r.poverty_status || "-"}</b></div>

    <div class="sec">5. การเดินทางจากที่พักอาศัยไปโรงเรียน</div>
    <div class="row cb-group">วิธีเดินทางหลัก
      ${["เดินเท้า","จักรยาน","รถโรงเรียน","รถจักรยานยนต์","รถยนต์","รถสาธารณะ"].map(v => cb(r.travel_method === v, v)).join("")}
    </div>
    <div class="row">ระยะทาง <b>${r.distance_to_school ?? "-"}</b> กม. (ไป-กลับ/วัน) ใช้เวลา <b>${r.travel_time_minutes ?? "-"}</b> นาที
      ค่าใช้จ่ายเดินทาง <b>${r.travel_cost_per_month ?? "-"}</b> บาท/เดือน
      เงินมาโรงเรียน <b>${r.student_money_per_day ?? "-"}</b> บาท/วัน</div>

    <div class="sec">6. ที่ตั้งที่พักอาศัย</div>
    <div class="row">${r.latitude && r.longitude ? `พิกัด GPS: ${r.latitude}, ${r.longitude}` : (r.home_condition || "-")}</div>

    <div class="sec">7. ภาพถ่ายที่พักอาศัย</div>
    ${photos.length ? `<div class="photo-grid">${photos.slice(0, 4).map(p => `<img src="${p}" alt=""/>`).join("")}</div>` : `<div class="row">— ไม่มีรูปภาพ —</div>`}

    <div class="sec">8-9. การรับรองข้อมูล</div>
    <div class="row" style="font-size:12pt;">ข้าพเจ้าขอรับรองว่าข้อมูลข้างต้นเป็นข้อมูลที่ถูกต้องของข้าพเจ้าจริง และรับทราบนโยบายคุ้มครองข้อมูลส่วนบุคคลของ กสศ.</div>
    <div class="sig-grid">
      <div><div class="sig-line">( ${fullName} )</div><div>นักเรียน</div></div>
      <div><div class="sig-line">( ${dash(`${r.guardian_prefix || ""}${r.guardian_first_name || ""} ${r.guardian_last_name || ""}`.trim())} )</div><div>ผู้ปกครอง</div></div>
    </div>

    <div class="sec">10. การรับรองข้อมูลโดยเจ้าหน้าที่ของรัฐ</div>
    <div class="row">ข้าพเจ้า <b>${dash(r.officer_name)}</b> เลขประจำตัวประชาชน <b>${dash(r.officer_id_card)}</b></div>
    <div class="row">ตำแหน่ง <b>${dash(r.officer_position)}</b></div>
    <div class="row cb-group">
      ${cb(r.officer_certified === true, "ขอรับรองว่าข้อมูลถูกต้อง ครบถ้วน เห็นควรพิจารณาขอรับเงินอุดหนุน")}
      ${cb(r.officer_certified === false, `ไม่ขอรับรอง เนื่องจาก ${r.officer_reject_reason || "………………………"}`)}
    </div>
    <div class="sig-grid">
      <div><div class="sig-line">( ${dash(r.officer_name)} )</div><div>เจ้าหน้าที่ของรัฐ</div></div>
      <div>
        ${school.director_signature_url ? `<img src="${school.director_signature_url}" style="height:44pt;"/>` : ""}
        <div class="sig-line">( ${school.director_name || "…………………"} )</div>
        <div>ผู้อำนวยการสถานศึกษา</div>
      </div>
    </div>

    <div class="footer-note">
      ผู้บันทึกข้อมูล <b>${r.visitor_name || "-"}</b> &nbsp;
      บันทึกวันที่ <b>${thaiDate(r.visit_date)}</b> &nbsp;
      วันที่พิมพ์ <b>${currentThaiDate()}</b>
    </div>
    <div class="sig-grid" style="grid-template-columns:1fr;">
      <div style="max-width:280pt;margin:0 auto;">
        <div class="sig-line">( ${r.visitor_name || "………………………"} )</div>
        <div>ครูผู้เยี่ยมบ้าน/สำรวจข้อมูล</div>
      </div>
    </div>
  </div>`;

  openPrintWindow(html, { title: `กสศ.01 - ${fullName}` });
}
