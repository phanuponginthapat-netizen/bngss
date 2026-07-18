// Starter templates per code. Users can load these into the editor as a base.
export type PrintPreset = {
  key: string;
  label: string;
  code: string;
  body_html: string;
  header_html?: string;
  footer_html?: string;
  css?: string;
  paper?: "A4" | "A5" | "A6" | "letter";
  orientation?: "portrait" | "landscape";
  sample_data?: any;
};

const sampleSchool = {
  school: { name: "โรงเรียนตัวอย่าง", address: "ต.ในเมือง อ.เมือง จ.ตัวอย่าง 10000" },
  class: { label: "ป.5/1" },
  semester: 1,
  year: 2568,
  student: { id: "12345", full_name: "เด็กชายตัวอย่าง ใจดี", prefix: "เด็กชาย", first_name: "ตัวอย่าง", last_name: "ใจดี" },
  students: [
    { id: "12345", no: 1, full_name: "เด็กชายตัวอย่าง ใจดี", score: 85, grade: "4" },
    { id: "12346", no: 2, full_name: "เด็กหญิงดอกไม้ บานสะพรั่ง", score: 78, grade: "3.5" },
  ],
};

export const PRINT_PRESETS: PrintPreset[] = [
  // --- ปกเอกสาร ปพ. ---
  {
    key: "cover_pp5", code: "pp5", label: "ปก ปพ.5 (แบบทางการ)",
    body_html: `<div class="cover">
  <div class="emblem">🇹🇭</div>
  <h1>ปพ.5</h1>
  <h2>แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน</h2>
  <div class="line"></div>
  <p>ชั้น <b>{{class.label}}</b> ภาคเรียนที่ <b>{{semester}}</b> ปีการศึกษา <b>{{beYear year}}</b></p>
  <p class="school">{{school.name}}</p>
  <p class="addr">{{school.address}}</p>
  <p class="foot">สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน กระทรวงศึกษาธิการ</p>
</div>`,
    css: `.cover{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8mm}
.cover .emblem{font-size:48mm;line-height:1}
.cover h1{font-size:56px;margin:0;letter-spacing:2mm}
.cover h2{font-size:26.7px;margin:0;font-weight:600}
.cover .line{width:60%;border-top:2px solid #000;margin:4mm 0}
.cover .school{font-size:24px;font-weight:700;margin-top:8mm}
.cover .addr{font-size:18.7px}
.cover .foot{margin-top:auto;font-size:16px}`,
    sample_data: sampleSchool,
  },
  {
    key: "cover_pp6", code: "pp6", label: "ปก ปพ.6 (แบบทางการ)",
    body_html: `<div class="cover">
  <div class="emblem">🇹🇭</div>
  <h1>ปพ.6</h1>
  <h2>แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล</h2>
  <div class="line"></div>
  <p>ของ <b>{{student.full_name}}</b></p>
  <p>เลขประจำตัว <b>{{student.id}}</b> ชั้น <b>{{class.label}}</b></p>
  <p>ภาคเรียนที่ <b>{{semester}}</b> ปีการศึกษา <b>{{beYear year}}</b></p>
  <p class="school">{{school.name}}</p>
</div>`,
    css: `.cover{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6mm}
.cover .emblem{font-size:42mm}
.cover h1{font-size:50.7px;margin:0;letter-spacing:2mm}
.cover h2{font-size:24px;margin:0}
.cover .line{width:50%;border-top:2px solid #000;margin:4mm 0}
.cover .school{font-size:24px;font-weight:700;margin-top:10mm}`,
    sample_data: sampleSchool,
  },

  // --- เนื้อหา ---
  {
    key: "pp5_basic", code: "pp5", label: "ปพ.5 — ตารางคะแนน (เริ่มต้น)",
    body_html: `<header class="hd">
  <h2>{{school.name}}</h2>
  <h3>แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.5)</h3>
  <p>ชั้น {{class.label}} · ภาคเรียนที่ {{semester}} · ปีการศึกษา {{beYear year}}</p>
</header>
<table class="grid">
  <thead><tr><th>เลขที่</th><th>ชื่อ-สกุล</th><th>คะแนน</th><th>เกรด</th></tr></thead>
  <tbody>
    {{#each students}}
    <tr><td>{{no}}</td><td>{{full_name}}</td><td>{{score}}</td><td>{{grade}}</td></tr>
    {{/each}}
  </tbody>
</table>`,
    css: `.hd{text-align:center;margin-bottom:6mm}
.hd h2,.hd h3{margin:1mm 0}
.grid{width:100%;border-collapse:collapse;font-size:14.7px}
.grid th,.grid td{border:0.4mm solid #000;padding:1.5mm 2mm;text-align:center}
.grid th{background:#eef}`,
    sample_data: sampleSchool,
  },
  {
    key: "pp6_basic", code: "pp6", label: "ปพ.6 — รายงานรายบุคคล",
    body_html: `<header class="hd">
  <h2>{{school.name}}</h2>
  <h3>รายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.6)</h3>
</header>
<section class="info">
  <p><b>ชื่อ-สกุล:</b> {{student.full_name}} &nbsp; <b>เลขประจำตัว:</b> {{student.id}}</p>
  <p><b>ชั้น:</b> {{class.label}} &nbsp; <b>ภาคเรียน:</b> {{semester}} &nbsp; <b>ปีการศึกษา:</b> {{beYear year}}</p>
</section>
<table class="grid">
  <thead><tr><th>รายวิชา</th><th>คะแนน</th><th>เกรด</th></tr></thead>
  <tbody>
    <tr><td>ภาษาไทย</td><td>85</td><td>4</td></tr>
    <tr><td>คณิตศาสตร์</td><td>78</td><td>3.5</td></tr>
  </tbody>
</table>`,
    css: `.hd{text-align:center}.info{margin:4mm 0;font-size:16px}
.grid{width:100%;border-collapse:collapse;font-size:14.7px}
.grid th,.grid td{border:0.4mm solid #000;padding:1.5mm 2mm;text-align:center}`,
    sample_data: sampleSchool,
  },
  {
    key: "transcript_basic", code: "transcript", label: "ปพ.1 — ระเบียนแสดงผลการเรียน",
    body_html: `<header class="hd"><h2>{{school.name}}</h2><h3>ระเบียนแสดงผลการเรียน (ปพ.1)</h3></header>
<p><b>ชื่อ:</b> {{student.full_name}} &nbsp; <b>เลขที่:</b> {{student.id}}</p>
<table class="grid"><thead><tr><th>รายวิชา</th><th>หน่วยกิต</th><th>เกรด</th></tr></thead>
<tbody><tr><td>ภาษาไทย</td><td>1.0</td><td>4</td></tr></tbody></table>`,
    css: `.hd{text-align:center}.grid{width:100%;border-collapse:collapse;font-size:14.7px}.grid th,.grid td{border:0.3mm solid #000;padding:1.5mm}`,
    sample_data: sampleSchool,
  },
  {
    key: "report_card_basic", code: "report_card", label: "สมุดรายงานประจำตัว (เริ่มต้น)",
    body_html: `<header class="hd"><h2>{{school.name}}</h2><h3>สมุดรายงานประจำตัวนักเรียน</h3></header>
<p>ของ <b>{{student.full_name}}</b> ชั้น {{class.label}}</p>
<p>ภาคเรียน {{semester}} · ปีการศึกษา {{beYear year}}</p>`,
    css: `.hd{text-align:center}`,
    sample_data: sampleSchool,
  },
  {
    key: "id_card_basic", code: "id_card", label: "บัตรประจำตัว 5.4×8.5 ซม.",
    paper: "A6", orientation: "portrait",
    body_html: `<div class="card">
  <div class="title">บัตรประจำตัวนักเรียน</div>
  <div class="school">{{school.name}}</div>
  <div class="row"><b>ชื่อ:</b> {{student.full_name}}</div>
  <div class="row"><b>เลขประจำตัว:</b> {{student.id}}</div>
  <div class="row"><b>ชั้น:</b> {{class.label}}</div>
</div>`,
    css: `.card{width:54mm;height:85mm;border:0.3mm solid #000;padding:3mm;font-size:12px;display:flex;flex-direction:column;gap:2mm}
.title{text-align:center;font-weight:700;font-size:13.3px}
.school{text-align:center;font-size:10.7px;color:#444}`,
    sample_data: sampleSchool,
  },
  {
    key: "certificate_basic", code: "certificate", label: "เกียรติบัตร (แนวนอน)",
    orientation: "landscape",
    body_html: `<div class="cert">
  <h1>เกียรติบัตร</h1>
  <p class="sub">ขอมอบให้</p>
  <h2>{{student.full_name}}</h2>
  <p>เพื่อแสดงว่าเป็นผู้มีผลการเรียนดีเด่น ปีการศึกษา {{beYear year}}</p>
  <p class="sign">ให้ไว้ ณ วันที่ {{thaiDate today}}</p>
</div>`,
    css: `.cert{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6mm;border:1.5mm double #b8860b;padding:10mm}
.cert h1{font-size:56px;margin:0;color:#8b6914;letter-spacing:4mm}
.cert h2{font-size:37.3px;margin:0;border-bottom:0.3mm solid #000;padding-bottom:2mm}
.cert .sub{font-size:18.7px;color:#666}
.cert .sign{margin-top:10mm;font-size:16px}`,
    sample_data: sampleSchool,
  },
];

export function presetsForCode(code: string) {
  return PRINT_PRESETS.filter((p) => p.code === code);
}
