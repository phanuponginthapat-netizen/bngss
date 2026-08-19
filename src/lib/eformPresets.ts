// Built-in E-Form preset templates — เป๊ะตามระเบียบงานสารบรรณ
// อ้างอิง: ระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ พ.ศ. ๒๕๒๖ และฉบับแก้ไข
// แบบ ๑-๑๐, ระเบียบวาระ/รายงานการประชุม, ใบปกเอกสารลับ
import type { EFormField, EFormTemplateRow } from "./eformTemplate";
import { BE_OFFSET } from "./dateBE";

export interface EFormPreset {
  id: string;
  name: string;
  description: string;
  category: "official" | "personnel" | "student" | "academic" | "custom";
  page_size: "A4" | "A5" | "Letter";
  font_family: string;
  font_size_pt: number;
  content_html: string;
  fields: EFormField[];
}

const F = (key: string, label: string, type: EFormField["type"] = "text", extra: Partial<EFormField> = {}): EFormField =>
  ({ key, label, type, ...extra });

const tk = (key: string, label?: string) =>
  `<span data-eform-field="${key}" style="border-bottom:1px dotted #888;padding:0 8px;color:#1a56db;">[${label ?? key}]</span>`;

// ----- ฟอนต์มาตรฐาน Sarabun 21px (16pt เดิม) -----
const FONT = `'Sarabun', sans-serif`;
const FONT_BASE = `font-family:${FONT};font-size:21px;line-height:1.5;`;

const garudaImg = `<span data-eform-field="garuda_emblem" data-eform-field-type="image" style="display:inline-block;width:1.5cm;height:1.5cm;border:1px dashed #aaa;vertical-align:middle;text-align:center;font-size:13.3px;line-height:1.5cm;">[ครุฑ ๑.๕]</span>`;
const garudaImg3cm = `<span data-eform-field="garuda_emblem" data-eform-field-type="image" style="display:inline-block;width:3cm;height:3cm;border:1px dashed #aaa;text-align:center;font-size:13.3px;line-height:3cm;">[ครุฑ ๓ ซม.]</span>`;

// แถบชั้นความลับ/ชั้นความเร็ว — มุมบน ระเบียบงานสารบรรณกำหนดให้พิมพ์ขอบบนของกระดาษ
const classificationStrip = `
  <div style="display:flex;justify-content:space-between;font-weight:bold;color:#c00;font-size:18.7px;margin-bottom:5.3px;">
    <span>${tk("urgency", "ชั้นความเร็ว")}</span>
    <span>${tk("classification", "ชั้นความลับ")}</span>
  </div>`;

// บล็อกที่อยู่ผู้ส่ง มุมขวาบน ตามระเบียบงานสารบรรณ
const senderAddressBlock = `
  <div style="line-height:1.4;text-align:left;max-width:8cm;margin-left:auto;word-wrap:break-word;overflow-wrap:break-word;white-space:pre-line;">
    <div><span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 2.7px;">[ชื่อส่วนราชการเจ้าของหนังสือ]</span></div>
    <div style="white-space:pre-line;"><span data-eform-field="school_address" style="border-bottom:1px dotted #888;padding:0 2.7px;white-space:pre-line;">[ที่อยู่]</span></div>
  </div>`;

// ============================================================
// แบบ ๑ — หนังสือภายนอก (กระดาษตราครุฑ)
// margins L 3cm / R 2cm / T 3cm / B 2cm | ครุฑ 3 ซม. | ย่อหน้า 2.5 ซม.
// ============================================================
const externalLetterHtml = `
<div style="${FONT_BASE}">
  ${classificationStrip}
  <div style="text-align:center;margin-bottom:8px;">${garudaImg3cm}</div>
  <table style="width:100%;border-collapse:collapse;margin-top:8px;">
    <tr>
      <td style="width:45%;vertical-align:top;">ที่ ${tk("doc_no", "เลขที่หนังสือ")}</td>
      <td style="vertical-align:top;">${senderAddressBlock}</td>
    </tr>
  </table>
  <p style="text-align:center;margin:24px 0;">${tk("doc_date", "วัน เดือน ปี")}</p>
  <p style="margin:0 0 8px 0;"><b>เรื่อง</b>&nbsp;&nbsp;${tk("subject", "เรื่อง")}</p>
  <p style="margin:0 0 8px 0;"><b>${tk("salutation", "คำขึ้นต้น")}</b>&nbsp;&nbsp;${tk("to", "ผู้รับ")}</p>
  <p style="margin:0 0 8px 0;"><b>อ้างถึง</b>&nbsp;&nbsp;${tk("reference", "อ้างถึง (ถ้ามี)")}</p>
  <p style="margin:0 0 18.7px 0;"><b>สิ่งที่ส่งมาด้วย</b>&nbsp;&nbsp;${tk("attachments", "สิ่งที่ส่งมาด้วย (ถ้ามี)")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("body", "ภาคเหตุ / ภาคความประสงค์ / ภาคสรุป")}</p>
  <div style="text-align:center;margin-left:auto;width:8cm;line-height:1.6;">
    <p style="margin:24px 0 32px 0;">${tk("closing", "คำลงท้าย (เช่น ขอแสดงความนับถือ)")}</p>
    <div style="height:53.3px;">${tk("signature", "ลงลายมือชื่อ")}</div>
    (<span data-eform-field="director_name" style="border-bottom:1px dotted #888;padding:0 8px;">[พิมพ์ชื่อเต็ม]</span>)<br/>
    <span data-eform-field="director_title" style="border-bottom:1px dotted #888;padding:0 8px;">[ตำแหน่ง]</span>
  </div>
  <div style="margin-top:48px;font-size:18.7px;line-height:1.4;">
    <span data-eform-field="dept_owner" style="border-bottom:1px dotted #888;padding:0 8px;">[ส่วนราชการเจ้าของเรื่อง]</span><br/>
    โทร. <span data-eform-field="school_phone" style="border-bottom:1px dotted #888;padding:0 8px;">[โทรศัพท์]</span><br/>
    โทรสาร ${tk("school_fax", "โทรสาร")}<br/>
    ไปรษณีย์อิเล็กทรอนิกส์ ${tk("school_email", "อีเมล (ถ้ามี)")}<br/>
    สำเนาส่ง ${tk("cc_to", "สำเนาส่ง (ถ้ามี)")}
  </div>
</div>
`;

// ============================================================
// แบบ ๒ — บันทึกข้อความ
// ส่วนราชการ + โทร. ในบรรทัดเดียว | ที่ ... วันที่ ... | เรื่อง | (คำขึ้นต้น)
// ============================================================
const memoHtml = `
<div style="${FONT_BASE}">
  ${classificationStrip}
  <div style="position:relative;height:1.8cm;margin-bottom:8px;">
    <div style="position:absolute;left:0;top:0;">${garudaImg}</div>
    <div style="text-align:center;font-size:38.7px;font-weight:bold;font-family:${FONT};line-height:1.6cm;">บันทึกข้อความ</div>
  </div>
  <p style="margin:8px 0 0 0;"><b>ส่วนราชการ</b>&nbsp;&nbsp;${tk("dept", "ส่วนราชการ")}&nbsp;&nbsp;โทร.&nbsp;${tk("dept_phone", "โทรศัพท์")}</p>
  <p style="margin:0;"><b>ที่</b>&nbsp;&nbsp;${tk("doc_no", "เลขที่หนังสือ")}&nbsp;&nbsp;&nbsp;&nbsp;<b>วันที่</b>&nbsp;&nbsp;${tk("doc_date", "วันที่")}</p>
  <p style="margin:0;"><b>เรื่อง</b>&nbsp;&nbsp;${tk("subject", "เรื่อง")}</p>
  <hr style="border:none;border-top:2px solid #000;margin:5.3px 0 16px 0;"/>
  <p style="margin:0 0 18.7px 0;">${tk("salutation", "คำขึ้นต้น (เช่น เรียน)")}&nbsp;&nbsp;${tk("to", "ผู้รับ")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("body", "เนื้อหา")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">จึงเรียนมาเพื่อโปรด${tk("purpose", "ทราบ/พิจารณา")}</p>
  <div style="margin-top:32px;text-align:center;margin-left:auto;width:8cm;line-height:1.6;">
    <div style="height:53.3px;">(ลงชื่อ) ${tk("signature", "ลายเซ็น")}</div>
    (<span data-eform-field="sender_name" style="border-bottom:1px dotted #888;padding:0 8px;">[พิมพ์ชื่อเต็ม]</span>)<br/>
    <span data-eform-field="sender_position" style="border-bottom:1px dotted #888;padding:0 8px;">[ตำแหน่ง]</span>
  </div>
</div>
`;

// ============================================================
// แบบ ๓ — หนังสือประทับตรา (แทนการลงชื่อ)
// ที่ + ถึง + ย่อหน้า 2.5 ซม. + ลงท้ายด้วย (ชื่อส่วนราชการ)/(ตรา)/(วัน เดือน ปี)/(ลงชื่อย่อกำกับตรา)
// ============================================================
const stampedLetterHtml = `
<div style="${FONT_BASE}">
  ${classificationStrip}
  <div style="text-align:center;margin-bottom:8px;">${garudaImg3cm}</div>
  <p style="margin:0;">ที่ ${tk("doc_no", "เลขที่หนังสือ")}</p>
  <p style="margin:10.7px 0 18.7px 0;">ถึง ${tk("to", "ผู้รับ")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("body", "เนื้อหา")}</p>
  <div style="text-align:center;margin-left:auto;width:9cm;margin-top:24px;line-height:1.6;">
    <p style="margin:0;"><span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อส่วนราชการที่ส่งหนังสือออก]</span></p>
    <div style="display:inline-block;width:3cm;height:3cm;border:1px dashed #aaa;border-radius:50%;line-height:3cm;font-size:13.3px;color:#888;">[ตราชื่อส่วนราชการ]</div>
    <p style="margin:8px 0 0 0;">${tk("doc_date", "วัน เดือน ปี")}</p>
    <p style="margin:24px 0 0 0;text-align:right;">(ลงชื่อย่อกำกับตรา) ${tk("initial_sig", "ลายเซ็นย่อ")}</p>
  </div>
  <div style="margin-top:32px;font-size:18.7px;line-height:1.4;">
    <span data-eform-field="dept_owner" style="border-bottom:1px dotted #888;padding:0 8px;">[ส่วนราชการเจ้าของเรื่อง]</span><br/>
    โทร. ${tk("school_phone", "โทรศัพท์")}
  </div>
</div>
`;

// ============================================================
// แบบ ๔ — คำสั่ง
// ============================================================
const orderHtml = `
<div style="${FONT_BASE}">
  <div style="text-align:center;">${garudaImg3cm}</div>
  <div style="text-align:center;margin-top:8px;line-height:1.4;">
    <p style="margin:0;font-weight:bold;font-size:29.3px;">คำสั่ง<span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อส่วนราชการ]</span></p>
    <p style="margin:0;">ที่ ${tk("order_no", "เลขที่คำสั่ง")}/${tk("order_year", "พ.ศ.")}</p>
    <p style="margin:0;font-weight:bold;">เรื่อง ${tk("subject", "เรื่อง")}</p>
    <p style="margin:8px 0;">---------------------------------</p>
  </div>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("preface", "คำนำ/หลักการและเหตุผล")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">อาศัยอำนาจตามความใน ${tk("authority", "อ้างอำนาจตาม...")} จึง${tk("action", "แต่งตั้ง/มอบหมาย")} ดังนี้</p>
  <p style="margin:0 0 18.7px 0;">${tk("body", "รายชื่อ/หน้าที่")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">ทั้งนี้ ตั้งแต่ ${tk("effective_date", "วันที่มีผล")}</p>
  <p style="margin:0 0 32px 0;text-align:center;">สั่ง ณ วันที่ ${tk("order_date", "วันที่")} พ.ศ. ${tk("order_year2", "พ.ศ.")}</p>
  <div style="text-align:center;margin-left:auto;width:8cm;line-height:1.6;">
    <div style="height:53.3px;">(ลงชื่อ) ${tk("signature", "ลายเซ็น")}</div>
    (<span data-eform-field="director_name" style="border-bottom:1px dotted #888;padding:0 8px;">[พิมพ์ชื่อเต็ม]</span>)<br/>
    <span data-eform-field="director_title" style="border-bottom:1px dotted #888;padding:0 8px;">[ตำแหน่ง]</span>
  </div>
</div>
`;

// ============================================================
// แบบ ๕ — ระเบียบ
// ============================================================
const regulationHtml = `
<div style="${FONT_BASE}">
  <div style="text-align:center;">${garudaImg3cm}</div>
  <div style="text-align:center;margin-top:8px;line-height:1.4;">
    <p style="margin:0;font-weight:bold;font-size:29.3px;">ระเบียบ<span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อส่วนราชการ]</span></p>
    <p style="margin:0;">ว่าด้วย ${tk("subject", "เรื่อง")}</p>
    <p style="margin:0;font-size:18.7px;color:#666;">(ฉบับที่ ${tk("issue_no", "เลขที่ฉบับ (ถ้ามี)")})</p>
    <p style="margin:0;">พ.ศ. ${tk("year", "พ.ศ.")}</p>
    <p style="margin:8px 0;">---------------------------------</p>
  </div>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">โดยที่เป็นการสมควร ${tk("preface", "เหตุผลในการออกระเบียบ")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">อาศัยอำนาจตามความใน ${tk("authority", "อ้างอำนาจตาม...")} จึงวางระเบียบไว้ดังต่อไปนี้</p>
  <p style="margin:0 0 10.7px 0;text-indent:2.5cm;"><b>ข้อ ๑</b>&nbsp;ระเบียบนี้เรียกว่า "ระเบียบ${tk("title_repeat", "ชื่อระเบียบ")} พ.ศ. ${tk("year2", "พ.ศ.")}"</p>
  <p style="margin:0 0 10.7px 0;text-indent:2.5cm;"><b>ข้อ ๒</b>&nbsp;ระเบียบนี้ให้ใช้บังคับตั้งแต่ ${tk("effective_date", "วันที่มีผลบังคับ")} เป็นต้นไป</p>
  <p style="margin:0 0 18.7px 0;">${tk("body", "ข้อ ๓ เป็นต้นไป")}</p>
  <p style="margin:0 0 10.7px 0;text-indent:2.5cm;"><b>ข้อ (สุดท้าย)</b>&nbsp;ให้ ${tk("custodian", "ผู้รักษาการตามระเบียบ")} เป็นผู้รักษาการตามระเบียบนี้</p>
  <p style="margin:24px 0 32px 0;text-align:center;">ประกาศ ณ วันที่ ${tk("issue_date", "วันที่ประกาศ")} พ.ศ. ${tk("year3", "พ.ศ.")}</p>
  <div style="text-align:center;margin-left:auto;width:8cm;line-height:1.6;">
    <div style="height:53.3px;">(ลงชื่อ) ${tk("signature", "ลายเซ็น")}</div>
    (<span data-eform-field="director_name" style="border-bottom:1px dotted #888;padding:0 8px;">[พิมพ์ชื่อเต็ม]</span>)<br/>
    <span data-eform-field="director_title" style="border-bottom:1px dotted #888;padding:0 8px;">[ตำแหน่ง]</span>
  </div>
</div>
`;

// ============================================================
// แบบ ๖ — ข้อบังคับ
// ============================================================
const rulesHtml = `
<div style="${FONT_BASE}">
  <div style="text-align:center;">${garudaImg3cm}</div>
  <div style="text-align:center;margin-top:8px;line-height:1.4;">
    <p style="margin:0;font-weight:bold;font-size:29.3px;">ข้อบังคับ<span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อส่วนราชการ]</span></p>
    <p style="margin:0;">ว่าด้วย ${tk("subject", "เรื่อง")}</p>
    <p style="margin:0;font-size:18.7px;color:#666;">(ฉบับที่ ${tk("issue_no", "เลขที่ฉบับ (ถ้ามี)")})</p>
    <p style="margin:0;">พ.ศ. ${tk("year", "พ.ศ.")}</p>
    <p style="margin:8px 0;">---------------------------------</p>
  </div>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">โดยที่เป็นการสมควร ${tk("preface", "เหตุผลการออกข้อบังคับ")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">อาศัยอำนาจตามความใน ${tk("authority", "อ้างอำนาจตาม...")} จึงออกข้อบังคับไว้ดังต่อไปนี้</p>
  <p style="margin:0 0 10.7px 0;text-indent:2.5cm;"><b>ข้อ ๑</b>&nbsp;ข้อบังคับนี้เรียกว่า "ข้อบังคับ${tk("title_repeat", "ชื่อข้อบังคับ")} พ.ศ. ${tk("year2", "พ.ศ.")}"</p>
  <p style="margin:0 0 10.7px 0;text-indent:2.5cm;"><b>ข้อ ๒</b>&nbsp;ข้อบังคับนี้ให้ใช้บังคับตั้งแต่ ${tk("effective_date", "วันที่มีผลบังคับ")} เป็นต้นไป</p>
  <p style="margin:0 0 18.7px 0;">${tk("body", "ข้อ ๓ เป็นต้นไป")}</p>
  <p style="margin:0 0 10.7px 0;text-indent:2.5cm;"><b>ข้อ (สุดท้าย)</b>&nbsp;ให้ ${tk("custodian", "ผู้รักษาการ")} เป็นผู้รักษาการตามข้อบังคับนี้</p>
  <p style="margin:24px 0 32px 0;text-align:center;">ประกาศ ณ วันที่ ${tk("issue_date", "วันที่ประกาศ")} พ.ศ. ${tk("year3", "พ.ศ.")}</p>
  <div style="text-align:center;margin-left:auto;width:8cm;line-height:1.6;">
    <div style="height:53.3px;">(ลงชื่อ) ${tk("signature", "ลายเซ็น")}</div>
    (<span data-eform-field="director_name" style="border-bottom:1px dotted #888;padding:0 8px;">[พิมพ์ชื่อเต็ม]</span>)<br/>
    <span data-eform-field="director_title" style="border-bottom:1px dotted #888;padding:0 8px;">[ตำแหน่ง]</span>
  </div>
</div>
`;

// ============================================================
// แบบ ๗ — ประกาศ
// ============================================================
const announcementHtml = `
<div style="${FONT_BASE}">
  <div style="text-align:center;">${garudaImg3cm}</div>
  <div style="text-align:center;margin-top:8px;line-height:1.4;">
    <p style="margin:0;font-weight:bold;font-size:29.3px;">ประกาศ<span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อส่วนราชการ]</span></p>
    <p style="margin:0;font-weight:bold;">เรื่อง ${tk("subject", "เรื่อง")}</p>
    <p style="margin:8px 0;">---------------------------------</p>
  </div>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("body", "ข้อความประกาศ")}</p>
  <p style="margin:24px 0 32px 0;text-align:center;">ประกาศ ณ วันที่ ${tk("issue_date", "วันที่")} พ.ศ. ${tk("year", "พ.ศ.")}</p>
  <div style="text-align:center;margin-left:auto;width:8cm;line-height:1.6;">
    <div style="height:53.3px;">(ลงชื่อ) ${tk("signature", "ลายเซ็น")}</div>
    (<span data-eform-field="director_name" style="border-bottom:1px dotted #888;padding:0 8px;">[พิมพ์ชื่อเต็ม]</span>)<br/>
    <span data-eform-field="director_title" style="border-bottom:1px dotted #888;padding:0 8px;">[ตำแหน่ง]</span>
  </div>
</div>
`;

// ============================================================
// แบบ ๘ — แถลงการณ์
// ลงท้ายด้วย (ส่วนราชการที่ออกแถลงการณ์) / วัน เดือน ปี — ไม่มีลายเซ็น
// ============================================================
const statementHtml = `
<div style="${FONT_BASE}">
  <div style="text-align:center;">${garudaImg3cm}</div>
  <div style="text-align:center;margin-top:8px;line-height:1.4;">
    <p style="margin:0;font-weight:bold;font-size:29.3px;">แถลงการณ์<span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อส่วนราชการ]</span></p>
    <p style="margin:0;font-weight:bold;">เรื่อง ${tk("subject", "เรื่อง")}</p>
    <p style="margin:0;font-size:18.7px;color:#666;">ฉบับที่ ${tk("issue_no", "ฉบับที่ (ถ้ามี)")}</p>
    <p style="margin:8px 0;">---------------------------------</p>
  </div>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("body", "ข้อความแถลงการณ์")}</p>
  <div style="margin-top:48px;text-align:center;margin-left:auto;width:9cm;line-height:1.6;">
    <p style="margin:0;"><span data-eform-field="school_name2" style="border-bottom:1px dotted #888;padding:0 8px;">[ส่วนราชการที่ออกแถลงการณ์]</span></p>
    <p style="margin:0;">${tk("issue_date", "วัน เดือน ปี")}</p>
  </div>
</div>
`;

// ============================================================
// แบบ ๙ — ข่าว
// ลงท้ายด้วย (ส่วนราชการที่ออกข่าว) / วัน เดือน ปี — ไม่มีลายเซ็น
// ============================================================
const newsRoyalHtml = `
<div style="${FONT_BASE}">
  <div style="text-align:center;">${garudaImg3cm}</div>
  <div style="text-align:center;margin-top:8px;line-height:1.4;">
    <p style="margin:0;font-weight:bold;font-size:29.3px;">ข่าว<span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อส่วนราชการ]</span></p>
    <p style="margin:0;font-weight:bold;">เรื่อง ${tk("subject", "เรื่อง")}</p>
    <p style="margin:0;font-size:18.7px;color:#666;">ฉบับที่ ${tk("issue_no", "ฉบับที่ (ถ้ามี)")}</p>
    <p style="margin:8px 0;">---------------------------------</p>
  </div>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("body", "ข้อความข่าว")}</p>
  <div style="margin-top:48px;text-align:center;margin-left:auto;width:9cm;line-height:1.6;">
    <p style="margin:0;"><span data-eform-field="school_name2" style="border-bottom:1px dotted #888;padding:0 8px;">[ส่วนราชการที่ออกข่าว]</span></p>
    <p style="margin:0;">${tk("issue_date", "วัน เดือน ปี")}</p>
  </div>
</div>
`;

// ============================================================
// แบบ ๑๐ — หนังสือรับรอง
// "เลขที่..." มุมซ้ายบน + (ส่วนราชการเจ้าของหนังสือ) ด้านขวา (ใต้ครุฑ)
// body เริ่มด้วย "หนังสือฉบับนี้ให้ไว้ เพื่อรับรองว่า ..."
// ============================================================
const certificateHtml = `
<div style="${FONT_BASE}">
  <div style="text-align:center;margin-bottom:8px;">${garudaImg3cm}</div>
  <table style="width:100%;border-collapse:collapse;margin-top:8px;">
    <tr>
      <td style="width:45%;vertical-align:top;">เลขที่ ${tk("cert_no", "เลขที่")}</td>
      <td style="vertical-align:top;text-align:right;"><span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ส่วนราชการเจ้าของหนังสือ]</span></td>
    </tr>
  </table>
  <p style="text-align:center;margin:24px 0;font-weight:bold;font-size:29.3px;">หนังสือรับรอง</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">หนังสือฉบับนี้ให้ไว้ เพื่อรับรองว่า ${tk("subject_name", "ชื่อผู้ที่ได้รับการรับรอง")} ตำแหน่ง ${tk("subject_position", "ตำแหน่ง")} สังกัด ${tk("subject_dept", "สังกัด/ที่ตั้ง")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("body", "ข้อความที่รับรอง")}</p>
  <p style="margin:24px 0 32px 0;text-align:center;">ให้ไว้ ณ วันที่ ${tk("issue_date", "วันที่")} พ.ศ. ${tk("year", "พ.ศ.")}</p>
  <div style="text-align:center;margin-left:auto;width:8cm;line-height:1.6;">
    <div style="height:53.3px;">(ลงชื่อ) ${tk("signature", "ลายเซ็น")}</div>
    (<span data-eform-field="director_name" style="border-bottom:1px dotted #888;padding:0 8px;">[พิมพ์ชื่อเต็ม]</span>)<br/>
    <span data-eform-field="director_title" style="border-bottom:1px dotted #888;padding:0 8px;">[ตำแหน่ง]</span>
  </div>
</div>
`;

// ============================================================
// ระเบียบวาระการประชุม
// ============================================================
const meetingAgendaHtml = `
<div style="${FONT_BASE}">
  <div style="text-align:center;line-height:1.5;">
    <p style="margin:0;font-weight:bold;font-size:26.7px;">ระเบียบวาระการประชุม${tk("meeting_topic", "หัวข้อ")}</p>
    <p style="margin:0;">ครั้งที่ ${tk("meeting_no", "ครั้งที่")}/${tk("year", "พ.ศ.")}</p>
    <p style="margin:0;">ในวันที่ ${tk("meeting_date", "วันที่")} เวลา ${tk("meeting_time", "เวลา")} น.</p>
    <p style="margin:0;">ณ ${tk("meeting_place", "สถานที่")}</p>
    <p style="margin:8px 0;">------------------------------------------------------------</p>
  </div>
  <p style="margin:18.7px 0 8px 0;"><b>ระเบียบวาระที่ ๑</b>&nbsp;เรื่องที่ประธานแจ้งที่ประชุมทราบ</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("agenda1", "รายละเอียดวาระ ๑")}</p>
  <p style="margin:0 0 8px 0;"><b>ระเบียบวาระที่ ๒</b>&nbsp;เรื่องรับรองรายงานการประชุม</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("agenda2", "ครั้งที่ใดของรายงาน")}</p>
  <p style="margin:0 0 8px 0;"><b>ระเบียบวาระที่ ๓</b>&nbsp;เรื่องที่เสนอให้ที่ประชุมทราบ</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("agenda3", "รายละเอียด ๓.๑, ๓.๒ ...")}</p>
  <p style="margin:0 0 8px 0;"><b>ระเบียบวาระที่ ๔</b>&nbsp;เรื่องที่เสนอให้ที่ประชุมพิจารณา</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("agenda4", "รายละเอียด ๔.๑, ๔.๒ ...")}</p>
  <p style="margin:0 0 8px 0;"><b>ระเบียบวาระที่ ๕</b>&nbsp;เรื่องอื่น ๆ (ถ้ามี)</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("agenda5", "รายละเอียดวาระ ๕")}</p>
  <p style="text-align:center;margin:24px 0;">---------------------------------------------</p>
</div>
`;

// ============================================================
// รายงานการประชุม
// ============================================================
const meetingMinutesHtml = `
<div style="${FONT_BASE}">
  <div style="text-align:center;line-height:1.5;">
    <p style="margin:0;font-weight:bold;font-size:26.7px;">รายงานการประชุม${tk("meeting_topic", "หัวข้อ")}</p>
    <p style="margin:0;">ครั้งที่ ${tk("meeting_no", "ครั้งที่")}/${tk("year", "พ.ศ.")}</p>
    <p style="margin:0;">ในวันที่ ${tk("meeting_date", "วันที่")} เวลา ${tk("meeting_time", "เวลา")} น.</p>
    <p style="margin:0;">ณ ${tk("meeting_place", "สถานที่")}</p>
    <p style="margin:8px 0;">------------------------------------------------------------</p>
  </div>
  <p style="margin:18.7px 0 8px 0;"><b>ผู้มาประชุม</b></p>
  <p style="margin:0 0 18.7px 0;text-indent:1cm;">${tk("attendees", "รายชื่อผู้มาประชุม")}</p>
  <p style="margin:0 0 8px 0;"><b>ผู้ไม่มาประชุม (ถ้ามี)</b></p>
  <p style="margin:0 0 18.7px 0;text-indent:1cm;">${tk("absentees", "รายชื่อผู้ไม่มาประชุม")}</p>
  <p style="margin:0 0 8px 0;"><b>ผู้เข้าร่วมประชุม (ถ้ามี)</b></p>
  <p style="margin:0 0 18.7px 0;text-indent:1cm;">${tk("guests", "รายชื่อผู้เข้าร่วม")}</p>
  <p style="margin:0 0 18.7px 0;"><b>เริ่มประชุมเวลา</b> ${tk("start_time", "เวลา")} น.</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">ประธานกล่าวเปิดประชุมและดำเนินการประชุมตามระเบียบวาระต่าง ๆ ดังต่อไปนี้</p>
  <p style="margin:0 0 8px 0;"><b>ระเบียบวาระที่ ๑</b>&nbsp;เรื่องที่ประธานแจ้งที่ประชุมทราบ</p>
  <p style="margin:0 0 5.3px 0;text-indent:2.5cm;">${tk("agenda1", "รายละเอียด")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;"><i>ที่ประชุมรับทราบ</i></p>
  <p style="margin:0 0 8px 0;"><b>ระเบียบวาระที่ ๒</b>&nbsp;เรื่องรับรองรายงานการประชุม</p>
  <p style="margin:0 0 5.3px 0;text-indent:2.5cm;">${tk("agenda2", "รายละเอียด")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;"><i>ที่ประชุมพิจารณาแล้ว รับรองรายงานการประชุมครั้งที่...</i></p>
  <p style="margin:0 0 8px 0;"><b>ระเบียบวาระที่ ๓</b>&nbsp;เรื่องที่เสนอให้ที่ประชุมทราบ</p>
  <p style="margin:0 0 5.3px 0;text-indent:2.5cm;">${tk("agenda3", "รายละเอียด")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;"><i>ที่ประชุมรับทราบ</i></p>
  <p style="margin:0 0 8px 0;"><b>ระเบียบวาระที่ ๔</b>&nbsp;เรื่องที่เสนอให้ที่ประชุมพิจารณา</p>
  <p style="margin:0 0 5.3px 0;text-indent:2.5cm;">${tk("agenda4", "รายละเอียด")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;"><i>มติที่ประชุม</i> ${tk("agenda4_result", "มติ")}</p>
  <p style="margin:0 0 8px 0;"><b>ระเบียบวาระที่ ๕</b>&nbsp;เรื่องอื่น ๆ (ถ้ามี)</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">${tk("agenda5", "รายละเอียด/นัดประชุมครั้งต่อไป")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">ประธานกล่าวปิดประชุม</p>
  <p style="margin:0 0 32px 0;"><b>เลิกประชุมเวลา</b> ${tk("end_time", "เวลา")} น.</p>
  <div style="text-align:center;margin-left:auto;width:9cm;line-height:1.6;">
    <p style="margin:0 0 10.7px 0;">ลงลายมือชื่อ</p>
    <div style="height:53.3px;">${tk("signature", "ลายเซ็น")}</div>
    (<span data-eform-field="recorder_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ผู้จดรายงานการประชุม]</span>)<br/>
    ผู้จดรายงานการประชุม
  </div>
</div>
`;

// ============================================================
// ใบปกเอกสารลับ (ลับ / ลับมาก / ลับที่สุด)
// ============================================================
const classifiedCover = (label: string) => `
<div style="font-family:${FONT};display:flex;flex-direction:column;justify-content:space-between;align-items:center;height:100%;min-height:25cm;padding:2cm 0;">
  <div style="font-size:48px;font-weight:bold;color:#c00;border:4px solid #c00;padding:10.7px 48px;letter-spacing:10.7px;">${label}</div>
  <div style="text-align:center;font-size:26.7px;line-height:2;">
    <p style="margin:0;">ใช้ปิดทับข้อมูลข่าวสารลับ</p>
    <p style="margin:32px 0 0 0;font-size:21px;color:#555;">เรื่อง ${tk("subject", "เรื่อง")}</p>
    <p style="margin:0;font-size:21px;color:#555;">ที่ ${tk("doc_no", "เลขที่")}</p>
    <p style="margin:0;font-size:21px;color:#555;">ส่วนราชการ <span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ส่วนราชการ]</span></p>
  </div>
  <div style="font-size:48px;font-weight:bold;color:#c00;border:4px solid #c00;padding:10.7px 48px;letter-spacing:10.7px;">${label}</div>
</div>
`;

// ============================================================
// ใบลา / ใบลาพักผ่อน / ปพ. ๕-๙ (คงเดิม)
// ============================================================
const leaveSickHtml = `
<div style="${FONT_BASE}">
  <div style="text-align:center;line-height:1.4;">
    <p style="margin:0;font-weight:bold;font-size:26.7px;">ใบลาป่วย ลากิจส่วนตัว ลาคลอดบุตร</p>
  </div>
  <p style="text-align:right;margin:24px 0 0 0;">เขียนที่ ${tk("place", "สถานที่")}</p>
  <p style="text-align:right;margin:0 0 18.7px 0;">วันที่ ${tk("write_date", "วันที่เขียน")}</p>
  <p style="margin:0 0 13.3px 0;"><b>เรื่อง</b>&nbsp;&nbsp;ขอ${tk("leave_type", "ประเภทการลา")}</p>
  <p style="margin:0 0 18.7px 0;"><b>เรียน</b>&nbsp;&nbsp;ผู้อำนวยการโรงเรียน <span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อโรงเรียน]</span></p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">ข้าพเจ้า ${tk("full_name", "ชื่อ-สกุล")} ตำแหน่ง ${tk("position", "ตำแหน่ง")}
  สังกัด ${tk("school_name2", "โรงเรียน")} ขอลา${tk("leave_type2", "ประเภท")} เนื่องจาก ${tk("reason", "เหตุผล")}
  ตั้งแต่วันที่ ${tk("from_date", "วันเริ่มลา")} ถึงวันที่ ${tk("to_date", "วันสิ้นสุด")} มีกำหนด ${tk("days", "จำนวนวัน")} วัน
  ในระหว่างลา ติดต่อข้าพเจ้าได้ที่ ${tk("contact", "ที่อยู่ติดต่อ")} โทร ${tk("phone", "โทรศัพท์")}</p>
  <p style="margin:0 0 32px 0;text-indent:2.5cm;">จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต</p>
  <div style="text-align:center;margin-left:auto;width:8cm;line-height:1.6;">
    <p style="margin:0 0 32px 0;">ขอแสดงความนับถือ</p>
    ${tk("signature", "ลายเซ็นผู้ลา")}<br/>
    (${tk("full_name2", "ชื่อ-สกุล")})<br/>
    ${tk("position2", "ตำแหน่ง")}
  </div>
</div>
`;

const vacationHtml = `
<div style="${FONT_BASE}">
  <p style="text-align:center;margin:0;font-weight:bold;font-size:26.7px;">ใบลาพักผ่อน</p>
  <p style="text-align:right;margin:24px 0 0 0;">เขียนที่ ${tk("place", "สถานที่")}</p>
  <p style="text-align:right;margin:0 0 18.7px 0;">วันที่ ${tk("write_date", "วันที่")}</p>
  <p style="margin:0 0 13.3px 0;"><b>เรื่อง</b>&nbsp;&nbsp;ขอลาพักผ่อน</p>
  <p style="margin:0 0 18.7px 0;"><b>เรียน</b>&nbsp;&nbsp;ผู้อำนวยการโรงเรียน <span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อโรงเรียน]</span></p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">ข้าพเจ้า ${tk("full_name", "ชื่อ-สกุล")} ตำแหน่ง ${tk("position", "ตำแหน่ง")}
  มีวันลาพักผ่อนสะสม ${tk("accumulated_days", "วันสะสม")} วัน และมีสิทธิ์ลาพักผ่อนประจำปีอีก ${tk("current_year_days", "ปีปัจจุบัน")} วัน
  รวมเป็น ${tk("total_days", "รวม")} วัน ขอลาพักผ่อนตั้งแต่วันที่ ${tk("from_date", "เริ่มลา")} ถึงวันที่ ${tk("to_date", "สิ้นสุด")} มีกำหนด ${tk("days", "จำนวนวัน")} วัน
  ในระหว่างลาติดต่อได้ที่ ${tk("contact", "ที่อยู่ติดต่อ")}</p>
  <p style="margin:0 0 32px 0;text-indent:2.5cm;">จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต</p>
  <div style="text-align:center;margin-left:auto;width:8cm;line-height:1.6;">
    <p style="margin:0 0 32px 0;">ขอแสดงความนับถือ</p>
    ${tk("signature", "ลายเซ็น")}<br/>
    (${tk("full_name2", "ชื่อ-สกุล")})
  </div>
</div>
`;

const pp5CoverHtml = `
<div style="font-family:${FONT};text-align:center;line-height:1.8;">
  <p style="margin:0;font-weight:bold;font-size:37.3px;">ปพ. ๕</p>
  <p style="margin:0;font-weight:bold;font-size:26.7px;">แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน</p>
  <p style="margin:0;font-size:21px;">ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</p>
  <div style="margin-top:53.3px;font-size:24px;line-height:2;">
    <p style="margin:0;">รหัสวิชา ${tk("subject_code", "รหัสวิชา")} &nbsp;&nbsp; รายวิชา ${tk("subject_name", "ชื่อวิชา")}</p>
    <p style="margin:0;">กลุ่มสาระการเรียนรู้ ${tk("learning_area", "กลุ่มสาระฯ")}</p>
    <p style="margin:0;">ชั้น ${tk("grade", "ชั้น")} &nbsp;ภาคเรียนที่ ${tk("semester", "ภาคเรียน")} &nbsp;ปีการศึกษา ${tk("year", "ปีการศึกษา")}</p>
  </div>
  <div style="margin-top:80px;font-size:24px;line-height:2;">
    <p style="margin:0;">ครูผู้สอน</p>
    <p style="margin:0;font-weight:bold;">${tk("teacher_name", "ชื่อครูผู้สอน")}</p>
    <p style="margin:0;">${tk("teacher_position", "ตำแหน่ง")}</p>
  </div>
  <div style="margin-top:106.7px;font-size:24px;line-height:1.8;">
    <p style="margin:0;font-weight:bold;"><span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อโรงเรียน]</span></p>
    <p style="margin:0;">สำนักงานเขตพื้นที่การศึกษา${tk("area", "เขต")}</p>
    <p style="margin:0;">สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน</p>
    <p style="margin:0;">กระทรวงศึกษาธิการ</p>
  </div>
</div>
`;

const pp6CoverHtml = `
<div style="font-family:${FONT};text-align:center;line-height:1.8;">
  <p style="margin:0;font-weight:bold;font-size:37.3px;">ปพ. ๖</p>
  <p style="margin:0;font-weight:bold;font-size:26.7px;">แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล</p>
  <p style="margin:0;font-size:21px;">ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</p>
  <div style="margin-top:80px;font-size:24px;line-height:2;">
    <p style="margin:0;">ชื่อ-สกุลนักเรียน <b>${tk("student_name", "ชื่อ-สกุล")}</b></p>
    <p style="margin:0;">เลขประจำตัวนักเรียน ${tk("student_code", "เลขประจำตัว")} &nbsp;&nbsp; เลขประจำตัวประชาชน ${tk("national_id", "เลขประชาชน")}</p>
    <p style="margin:0;">ชั้น ${tk("grade", "ชั้น")} &nbsp;ห้อง ${tk("room", "ห้อง")} &nbsp;ปีการศึกษา ${tk("year", "ปีการศึกษา")}</p>
    <p style="margin:0;">ครูที่ปรึกษา ${tk("advisor_name", "ครูที่ปรึกษา")}</p>
  </div>
  <div style="margin-top:133.3px;font-size:24px;line-height:1.8;">
    <p style="margin:0;font-weight:bold;"><span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อโรงเรียน]</span></p>
    <p style="margin:0;">สำนักงานเขตพื้นที่การศึกษา${tk("area", "เขต")}</p>
    <p style="margin:0;">สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน</p>
    <p style="margin:0;">กระทรวงศึกษาธิการ</p>
  </div>
</div>
`;

const pp7Html = `
<div style="${FONT_BASE}">
  <div style="text-align:center;margin-bottom:8px;">${garudaImg}</div>
  <p style="text-align:right;margin:0;">เลขที่ ${tk("cert_no", "เลขที่")}</p>
  <p style="text-align:center;margin:8px 0;font-weight:bold;font-size:29.3px;">ปพ. ๗</p>
  <p style="text-align:center;margin:0;font-weight:bold;font-size:26.7px;">ใบรับรองผลการเรียน</p>
  <hr style="margin:24px auto;width:5cm;border:none;border-top:1.3px solid #000;"/>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;"><span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อโรงเรียน]</span> ขอรับรองว่า ${tk("student_name", "ชื่อ-สกุลนักเรียน")} เลขประจำตัวนักเรียน ${tk("student_code", "เลขประจำตัว")} เลขประจำตัวประชาชน ${tk("national_id", "เลขประชาชน")} เกิดวันที่ ${tk("birth_date", "วันเกิด")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">เป็นนักเรียนของโรงเรียน เมื่อสิ้นภาคเรียนที่ ${tk("semester", "ภาคเรียน")} ปีการศึกษา ${tk("year", "ปีการศึกษา")} กำลังศึกษาอยู่ในชั้น ${tk("grade", "ชั้น")} มีผลการเรียนเฉลี่ยตลอดหลักสูตร ${tk("gpa", "GPA")} ความประพฤติ ${tk("conduct", "ความประพฤติ")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">ให้ไว้ ณ วันที่ ${tk("issue_date", "วันที่ออก")}</p>
  <div style="text-align:center;margin-left:auto;width:8cm;margin-top:48px;">
    ${tk("signature", "ลายเซ็น ผอ.")}<br/>
    (<span data-eform-field="director_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อ ผอ.]</span>)<br/>
    <span data-eform-field="director_title" style="border-bottom:1px dotted #888;padding:0 8px;">[ตำแหน่ง]</span>
  </div>
</div>
`;

const pp8CoverHtml = `
<div style="font-family:${FONT};text-align:center;line-height:1.8;">
  <p style="margin:0;font-weight:bold;font-size:37.3px;">ปพ. ๘</p>
  <p style="margin:0;font-weight:bold;font-size:26.7px;">ระเบียนสะสม</p>
  <p style="margin:0;font-size:21px;">ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</p>
  <div style="margin-top:80px;font-size:24px;line-height:2;">
    <p style="margin:0;">ชื่อ-สกุล <b>${tk("student_name", "ชื่อ-สกุลนักเรียน")}</b></p>
    <p style="margin:0;">เลขประจำตัวนักเรียน ${tk("student_code", "เลขประจำตัว")}</p>
    <p style="margin:0;">เลขประจำตัวประชาชน ${tk("national_id", "เลขประชาชน")}</p>
    <p style="margin:0;">วัน/เดือน/ปีเกิด ${tk("birth_date", "วันเกิด")}</p>
    <p style="margin:0;">เริ่มเข้าศึกษาในชั้น ${tk("entry_grade", "ชั้นแรกเข้า")} ปีการศึกษา ${tk("entry_year", "ปีเข้าเรียน")}</p>
  </div>
  <div style="margin-top:106.7px;font-size:24px;line-height:1.8;">
    <p style="margin:0;font-weight:bold;"><span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อโรงเรียน]</span></p>
    <p style="margin:0;">สำนักงานเขตพื้นที่การศึกษา${tk("area", "เขต")}</p>
    <p style="margin:0;">สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน</p>
    <p style="margin:0;">กระทรวงศึกษาธิการ</p>
  </div>
</div>
`;

const pp9CoverHtml = `
<div style="font-family:${FONT};text-align:center;line-height:1.8;">
  <p style="margin:0;font-weight:bold;font-size:37.3px;">ปพ. ๙</p>
  <p style="margin:0;font-weight:bold;font-size:26.7px;">สมุดบันทึกผลการเรียน</p>
  <p style="margin:0;font-size:21px;">ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</p>
  <div style="margin-top:80px;font-size:24px;line-height:2;">
    <p style="margin:0;">ชื่อ-สกุล <b>${tk("student_name", "ชื่อ-สกุลนักเรียน")}</b></p>
    <p style="margin:0;">เลขประจำตัวนักเรียน ${tk("student_code", "เลขประจำตัว")} &nbsp;ชั้น ${tk("grade", "ชั้น")}</p>
    <p style="margin:0;">ปีการศึกษา ${tk("year", "ปีการศึกษา")}</p>
  </div>
  <div style="margin-top:133.3px;font-size:24px;line-height:1.8;">
    <p style="margin:0;font-weight:bold;"><span data-eform-field="school_name" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อโรงเรียน]</span></p>
    <p style="margin:0;">สำนักงานเขตพื้นที่การศึกษา${tk("area", "เขต")}</p>
    <p style="margin:0;">สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน กระทรวงศึกษาธิการ</p>
  </div>
</div>
`;

// หนังสือเชิญประชุม (ยังคงไว้ใช้แทน external letter เพื่อนัดประชุม)
const meetingInviteHtml = `
<div style="${FONT_BASE}">
  ${classificationStrip}
  <div style="text-align:center;margin-bottom:8px;">${garudaImg3cm}</div>
  <table style="width:100%;border-collapse:collapse;margin-top:8px;">
    <tr>
      <td style="width:45%;vertical-align:top;">ที่ ${tk("doc_no", "เลขที่หนังสือ")}</td>
      <td style="vertical-align:top;">${senderAddressBlock}</td>
    </tr>
  </table>
  <p style="text-align:center;margin:24px 0;">${tk("doc_date", "วัน เดือน ปี")}</p>
  <p style="margin:0 0 8px 0;"><b>เรื่อง</b>&nbsp;&nbsp;ขอเชิญประชุม${tk("meeting_topic", "หัวข้อการประชุม")}</p>
  <p style="margin:0 0 18.7px 0;"><b>เรียน</b>&nbsp;&nbsp;${tk("to", "ผู้รับ")}</p>
  <p style="margin:0 0 18.7px 0;text-indent:2.5cm;">ด้วย<span data-eform-field="school_name2" style="border-bottom:1px dotted #888;padding:0 8px;">[ชื่อหน่วยงาน]</span> กำหนดจัดประชุม${tk("meeting_topic2", "หัวข้อ")} ในวันที่ ${tk("meeting_date", "วันประชุม")} เวลา ${tk("meeting_time", "เวลา")} ณ ${tk("meeting_place", "สถานที่")}</p>
  <p style="margin:0 0 32px 0;text-indent:2.5cm;">จึงเรียนมาเพื่อโปรดเข้าร่วมประชุมตามวัน เวลา และสถานที่ดังกล่าว</p>
  <div style="text-align:center;margin-left:auto;width:8cm;line-height:1.6;">
    <p style="margin:0 0 48px 0;">ขอแสดงความนับถือ</p>
    (<span data-eform-field="director_name" style="border-bottom:1px dotted #888;padding:0 8px;">[พิมพ์ชื่อเต็ม]</span>)<br/>
    <span data-eform-field="director_title" style="border-bottom:1px dotted #888;padding:0 8px;">[ตำแหน่ง]</span>
  </div>
</div>
`;

// ============================================================
//  EXPORTED PRESETS
// ============================================================
export const EFORM_PRESETS: EFormPreset[] = [
  // ---------- บุคลากร ----------
  {
    id: "leave_sick",
    name: "ใบลาป่วย / ลากิจส่วนตัว",
    description: "แบบฟอร์มใบลาตามระเบียบสำนักนายกรัฐมนตรี",
    category: "personnel",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: leaveSickHtml,
    fields: [
      F("place", "เขียนที่"),
      F("write_date", "วันที่เขียน", "autofill", { autofillSource: "today_thai" }),
      F("leave_type", "ประเภทการลา", "select", { options: ["ลาป่วย", "ลากิจส่วนตัว", "ลาคลอดบุตร"] }),
      F("school_name", "ชื่อโรงเรียน", "autofill", { autofillSource: "school.name" }),
      F("full_name", "ชื่อ-สกุล", "autofill", { autofillSource: "user.name" }),
      F("position", "ตำแหน่ง", "autofill", { autofillSource: "user.position" }),
      F("school_name2", "โรงเรียน (สังกัด)", "autofill", { autofillSource: "school.name" }),
      F("leave_type2", "ประเภทลา (ซ้ำ)"),
      F("reason", "เหตุผล", "textarea", { required: true }),
      F("from_date", "วันเริ่มลา", "date", { required: true }),
      F("to_date", "วันสิ้นสุด", "date", { required: true }),
      F("days", "จำนวนวัน", "number", { required: true }),
      F("contact", "ที่อยู่ติดต่อ", "textarea"),
      F("phone", "โทรศัพท์"),
      F("signature", "ลายเซ็น", "signature"),
      F("full_name2", "ชื่อ-สกุล (พิมพ์)", "autofill", { autofillSource: "user.name" }),
      F("position2", "ตำแหน่ง (พิมพ์)", "autofill", { autofillSource: "user.position" }),
    ],
  },
  {
    id: "leave_vacation",
    name: "ใบลาพักผ่อน",
    description: "แบบฟอร์มลาพักผ่อนประจำปีของข้าราชการครู",
    category: "personnel",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: vacationHtml,
    fields: [
      F("place", "เขียนที่"),
      F("write_date", "วันที่", "autofill", { autofillSource: "today_thai" }),
      F("school_name", "ชื่อโรงเรียน", "autofill", { autofillSource: "school.name" }),
      F("full_name", "ชื่อ-สกุล", "autofill", { autofillSource: "user.name" }),
      F("position", "ตำแหน่ง", "autofill", { autofillSource: "user.position" }),
      F("accumulated_days", "วันลาสะสม", "number"),
      F("current_year_days", "วันลาปีปัจจุบัน", "number"),
      F("total_days", "รวม", "number"),
      F("from_date", "เริ่มลา", "date", { required: true }),
      F("to_date", "สิ้นสุด", "date", { required: true }),
      F("days", "จำนวนวัน", "number", { required: true }),
      F("contact", "ที่อยู่ติดต่อ", "textarea"),
      F("signature", "ลายเซ็น", "signature"),
      F("full_name2", "ชื่อ-สกุล (พิมพ์)", "autofill", { autofillSource: "user.name" }),
    ],
  },

  // ---------- ราชการ (แบบ ๑-๑๐) ----------
  {
    id: "external_letter",
    name: "แบบ ๑ — หนังสือภายนอก",
    description: "หนังสือราชการภายนอกบนกระดาษตราครุฑ ตามระเบียบงานสารบรรณ พ.ศ. ๒๕๒๖",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: externalLetterHtml,
    fields: [
      F("urgency", "ชั้นความเร็ว", "select", { options: ["", "ด่วน", "ด่วนมาก", "ด่วนที่สุด"] }),
      F("classification", "ชั้นความลับ", "select", { options: ["", "ลับ", "ลับมาก", "ลับที่สุด"] }),
      F("doc_no", "เลขที่หนังสือ", "text", { required: true }),
      F("school_name", "ส่วนราชการเจ้าของหนังสือ", "autofill", { autofillSource: "school.name" }),
      F("school_address", "ที่อยู่", "autofill", { autofillSource: "school.address" }),
      F("doc_date", "วัน เดือน ปี", "autofill", { autofillSource: "today_thai" }),
      F("subject", "เรื่อง", "text", { required: true }),
      F("salutation", "คำขึ้นต้น", "select", { options: ["เรียน", "กราบเรียน", "ขอประทานกราบเรียน"], defaultValue: "เรียน" }),
      F("to", "ผู้รับ", "text", { required: true }),
      F("reference", "อ้างถึง (ถ้ามี)"),
      F("attachments", "สิ่งที่ส่งมาด้วย", "textarea"),
      F("body", "เนื้อหา", "textarea", { required: true }),
      F("closing", "คำลงท้าย", "select", { options: ["ขอแสดงความนับถือ", "ขอแสดงความนับถืออย่างยิ่ง", "ขอแสดงความนับถืออย่างสูง"], defaultValue: "ขอแสดงความนับถือ" }),
      F("signature", "ลงลายมือชื่อ", "signature"),
      F("director_name", "พิมพ์ชื่อเต็ม", "autofill", { autofillSource: "director.name" }),
      F("director_title", "ตำแหน่ง", "autofill", { autofillSource: "director.title" }),
      F("dept_owner", "ส่วนราชการเจ้าของเรื่อง", "autofill", { autofillSource: "school.name" }),
      F("school_phone", "โทรศัพท์", "autofill", { autofillSource: "school.phone" }),
      F("school_fax", "โทรสาร"),
      F("school_email", "ไปรษณีย์อิเล็กทรอนิกส์"),
      F("cc_to", "สำเนาส่ง"),
    ],
  },
  {
    id: "memo",
    name: "แบบ ๒ — บันทึกข้อความ",
    description: "บันทึกข้อความภายในส่วนราชการ ตามระเบียบงานสารบรรณ",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: memoHtml,
    fields: [
      F("urgency", "ชั้นความเร็ว", "select", { options: ["", "ด่วน", "ด่วนมาก", "ด่วนที่สุด"] }),
      F("classification", "ชั้นความลับ", "select", { options: ["", "ลับ", "ลับมาก", "ลับที่สุด"] }),
      F("dept", "ส่วนราชการ", "autofill", { autofillSource: "school.name" }),
      F("dept_phone", "โทรศัพท์ภายใน", "autofill", { autofillSource: "school.phone" }),
      F("doc_no", "เลขที่หนังสือ"),
      F("doc_date", "วันที่", "autofill", { autofillSource: "today_thai" }),
      F("subject", "เรื่อง", "text", { required: true }),
      F("salutation", "คำขึ้นต้น", "select", { options: ["เรียน", "กราบเรียน"], defaultValue: "เรียน" }),
      F("to", "ผู้รับ", "text", { required: true }),
      F("body", "เนื้อหา", "textarea", { required: true }),
      F("purpose", "วัตถุประสงค์", "select", { options: ["ทราบ", "พิจารณา", "พิจารณาอนุมัติ", "ทราบและพิจารณา"], defaultValue: "ทราบและพิจารณา" }),
      F("signature", "ลายเซ็น", "signature"),
      F("sender_name", "พิมพ์ชื่อเต็ม", "autofill", { autofillSource: "user.name" }),
      F("sender_position", "ตำแหน่ง", "autofill", { autofillSource: "user.position" }),
    ],
  },
  {
    id: "stamped_letter",
    name: "แบบ ๓ — หนังสือประทับตรา",
    description: "หนังสือประทับตราแทนการลงชื่อ (ที่ + ถึง) ตามระเบียบงานสารบรรณ",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: stampedLetterHtml,
    fields: [
      F("urgency", "ชั้นความเร็ว", "select", { options: ["", "ด่วน", "ด่วนมาก", "ด่วนที่สุด"] }),
      F("classification", "ชั้นความลับ", "select", { options: ["", "ลับ", "ลับมาก", "ลับที่สุด"] }),
      F("doc_no", "เลขที่หนังสือ", "text", { required: true }),
      F("to", "ผู้รับ (ถึง)", "text", { required: true }),
      F("body", "เนื้อหา", "textarea", { required: true }),
      F("school_name", "ชื่อส่วนราชการที่ส่ง", "autofill", { autofillSource: "school.name" }),
      F("doc_date", "วัน เดือน ปี", "autofill", { autofillSource: "today_thai" }),
      F("initial_sig", "ลายเซ็นย่อกำกับตรา", "signature"),
      F("dept_owner", "ส่วนราชการเจ้าของเรื่อง", "autofill", { autofillSource: "school.name" }),
      F("school_phone", "โทรศัพท์", "autofill", { autofillSource: "school.phone" }),
    ],
  },
  {
    id: "school_order",
    name: "แบบ ๔ — คำสั่ง",
    description: "คำสั่งของส่วนราชการ แต่งตั้ง/มอบหมายหน้าที่ ตามระเบียบงานสารบรรณ",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: orderHtml,
    fields: [
      F("school_name", "ชื่อส่วนราชการ", "autofill", { autofillSource: "school.name" }),
      F("order_no", "เลขที่คำสั่ง", "text", { required: true }),
      F("order_year", "พ.ศ.", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("subject", "เรื่อง", "text", { required: true }),
      F("preface", "หลักการและเหตุผล", "textarea"),
      F("authority", "อาศัยอำนาจตาม", "textarea"),
      F("action", "การกระทำ", "text", { defaultValue: "แต่งตั้ง" }),
      F("body", "รายชื่อ/หน้าที่", "textarea", { required: true }),
      F("effective_date", "วันที่มีผล", "text", { defaultValue: "บัดนี้เป็นต้นไป" }),
      F("order_date", "วันที่ออกคำสั่ง", "autofill", { autofillSource: "today_thai" }),
      F("order_year2", "พ.ศ.", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("signature", "ลายเซ็น", "signature"),
      F("director_name", "พิมพ์ชื่อเต็ม", "autofill", { autofillSource: "director.name" }),
      F("director_title", "ตำแหน่ง", "autofill", { autofillSource: "director.title" }),
    ],
  },
  {
    id: "regulation",
    name: "แบบ ๕ — ระเบียบ",
    description: "ระเบียบของส่วนราชการ ออกเพื่อถือปฏิบัติเป็นการประจำ",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: regulationHtml,
    fields: [
      F("school_name", "ชื่อส่วนราชการ", "autofill", { autofillSource: "school.name" }),
      F("subject", "เรื่อง (ว่าด้วย...)", "text", { required: true }),
      F("issue_no", "เลขที่ฉบับ"),
      F("year", "พ.ศ.", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("preface", "เหตุผลในการออกระเบียบ", "textarea"),
      F("authority", "อ้างอำนาจตาม", "textarea"),
      F("title_repeat", "ชื่อระเบียบ (ซ้ำ)", "text"),
      F("year2", "พ.ศ. (ซ้ำ)", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("effective_date", "วันที่มีผลบังคับ", "text"),
      F("body", "ข้อความระเบียบ (ข้อ ๓ เป็นต้นไป)", "textarea", { required: true }),
      F("custodian", "ผู้รักษาการตามระเบียบ", "text"),
      F("issue_date", "วันที่ประกาศ", "autofill", { autofillSource: "today_thai" }),
      F("year3", "พ.ศ.", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("signature", "ลายเซ็น", "signature"),
      F("director_name", "พิมพ์ชื่อเต็ม", "autofill", { autofillSource: "director.name" }),
      F("director_title", "ตำแหน่ง", "autofill", { autofillSource: "director.title" }),
    ],
  },
  {
    id: "rules",
    name: "แบบ ๖ — ข้อบังคับ",
    description: "ข้อบังคับของส่วนราชการ อาศัยอำนาจของกฎหมาย",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: rulesHtml,
    fields: [
      F("school_name", "ชื่อส่วนราชการ", "autofill", { autofillSource: "school.name" }),
      F("subject", "เรื่อง (ว่าด้วย...)", "text", { required: true }),
      F("issue_no", "เลขที่ฉบับ"),
      F("year", "พ.ศ.", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("preface", "เหตุผลการออกข้อบังคับ", "textarea"),
      F("authority", "อ้างอำนาจตาม", "textarea"),
      F("title_repeat", "ชื่อข้อบังคับ", "text"),
      F("year2", "พ.ศ. (ซ้ำ)", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("effective_date", "วันที่มีผล", "text"),
      F("body", "ข้อความข้อบังคับ", "textarea", { required: true }),
      F("custodian", "ผู้รักษาการ", "text"),
      F("issue_date", "วันที่ประกาศ", "autofill", { autofillSource: "today_thai" }),
      F("year3", "พ.ศ.", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("signature", "ลายเซ็น", "signature"),
      F("director_name", "พิมพ์ชื่อเต็ม", "autofill", { autofillSource: "director.name" }),
      F("director_title", "ตำแหน่ง", "autofill", { autofillSource: "director.title" }),
    ],
  },
  {
    id: "announcement",
    name: "แบบ ๗ — ประกาศ",
    description: "ประกาศของส่วนราชการ แจ้งให้ทราบหรือแนะแนวทางปฏิบัติ",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: announcementHtml,
    fields: [
      F("school_name", "ชื่อส่วนราชการ", "autofill", { autofillSource: "school.name" }),
      F("subject", "เรื่อง", "text", { required: true }),
      F("body", "ข้อความประกาศ", "textarea", { required: true }),
      F("issue_date", "วันที่ประกาศ", "autofill", { autofillSource: "today_thai" }),
      F("year", "พ.ศ.", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("signature", "ลายเซ็น", "signature"),
      F("director_name", "พิมพ์ชื่อเต็ม", "autofill", { autofillSource: "director.name" }),
      F("director_title", "ตำแหน่ง", "autofill", { autofillSource: "director.title" }),
    ],
  },
  {
    id: "statement",
    name: "แบบ ๘ — แถลงการณ์",
    description: "แถลงการณ์ของส่วนราชการ ลงท้ายด้วยชื่อส่วนราชการ + วัน เดือน ปี (ไม่มีลายเซ็น)",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: statementHtml,
    fields: [
      F("school_name", "ชื่อส่วนราชการ", "autofill", { autofillSource: "school.name" }),
      F("subject", "เรื่อง", "text", { required: true }),
      F("issue_no", "ฉบับที่"),
      F("body", "ข้อความแถลงการณ์", "textarea", { required: true }),
      F("school_name2", "ส่วนราชการที่ออกแถลงการณ์", "autofill", { autofillSource: "school.name" }),
      F("issue_date", "วัน เดือน ปี", "autofill", { autofillSource: "today_thai" }),
    ],
  },
  {
    id: "news_royal",
    name: "แบบ ๙ — ข่าว",
    description: "ข่าวประชาสัมพันธ์ของส่วนราชการ ตามระเบียบงานสารบรรณ",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: newsRoyalHtml,
    fields: [
      F("school_name", "ชื่อส่วนราชการ", "autofill", { autofillSource: "school.name" }),
      F("subject", "เรื่อง", "text", { required: true }),
      F("issue_no", "ฉบับที่"),
      F("body", "ข้อความข่าว", "textarea", { required: true }),
      F("school_name2", "ส่วนราชการที่ออกข่าว", "autofill", { autofillSource: "school.name" }),
      F("issue_date", "วัน เดือน ปี", "autofill", { autofillSource: "today_thai" }),
    ],
  },
  {
    id: "certificate_official",
    name: "แบบ ๑๐ — หนังสือรับรอง",
    description: "หนังสือรับรองที่ส่วนราชการออกให้บุคคล/นิติบุคคล/หน่วยงาน",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: certificateHtml,
    fields: [
      F("cert_no", "เลขที่", "text", { required: true }),
      F("school_name", "ส่วนราชการเจ้าของหนังสือ", "autofill", { autofillSource: "school.name" }),
      F("subject_name", "ชื่อ-สกุล / นิติบุคคล / หน่วยงาน", "text", { required: true }),
      F("subject_position", "ตำแหน่ง"),
      F("subject_dept", "สังกัด/ที่ตั้ง"),
      F("body", "ข้อความที่รับรอง", "textarea", { required: true }),
      F("issue_date", "วันที่", "autofill", { autofillSource: "today_thai" }),
      F("year", "พ.ศ.", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("signature", "ลายเซ็น", "signature"),
      F("director_name", "พิมพ์ชื่อเต็ม", "autofill", { autofillSource: "director.name" }),
      F("director_title", "ตำแหน่ง", "autofill", { autofillSource: "director.title" }),
    ],
  },

  // ---------- ประชุม ----------
  {
    id: "meeting_invite",
    name: "หนังสือเชิญประชุม",
    description: "หนังสือเชิญประชุมภายใน/ภายนอก (โครงสร้างเดียวกับหนังสือภายนอก)",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: meetingInviteHtml,
    fields: [
      F("urgency", "ชั้นความเร็ว", "select", { options: ["", "ด่วน", "ด่วนมาก", "ด่วนที่สุด"] }),
      F("classification", "ชั้นความลับ", "select", { options: ["", "ลับ", "ลับมาก", "ลับที่สุด"] }),
      F("doc_no", "เลขที่หนังสือ", "text", { required: true }),
      F("school_name", "ชื่อโรงเรียน", "autofill", { autofillSource: "school.name" }),
      F("school_address", "ที่อยู่โรงเรียน", "autofill", { autofillSource: "school.address" }),
      F("doc_date", "วัน เดือน ปี", "autofill", { autofillSource: "today_thai" }),
      F("meeting_topic", "หัวข้อการประชุม", "text", { required: true }),
      F("to", "ผู้รับ", "text", { required: true }),
      F("school_name2", "ชื่อโรงเรียน (ซ้ำ)", "autofill", { autofillSource: "school.name" }),
      F("meeting_topic2", "หัวข้อ (ซ้ำ)"),
      F("meeting_date", "วันที่ประชุม", "date", { required: true }),
      F("meeting_time", "เวลา", "text", { required: true }),
      F("meeting_place", "สถานที่", "text", { required: true }),
      F("director_name", "พิมพ์ชื่อเต็ม", "autofill", { autofillSource: "director.name" }),
      F("director_title", "ตำแหน่ง", "autofill", { autofillSource: "director.title" }),
    ],
  },
  {
    id: "meeting_agenda",
    name: "ระเบียบวาระการประชุม",
    description: "ระเบียบวาระการประชุม ๕ วาระ ตามมาตรฐานราชการ",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: meetingAgendaHtml,
    fields: [
      F("meeting_topic", "หัวข้อ", "text", { required: true }),
      F("meeting_no", "ครั้งที่", "text", { required: true }),
      F("year", "พ.ศ.", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("meeting_date", "วันที่ประชุม", "date", { required: true }),
      F("meeting_time", "เวลา", "text", { required: true }),
      F("meeting_place", "สถานที่", "text"),
      F("agenda1", "วาระ ๑ ประธานแจ้ง", "textarea"),
      F("agenda2", "วาระ ๒ รับรองรายงานครั้งที่...", "textarea"),
      F("agenda3", "วาระ ๓ เรื่องเสนอให้ทราบ", "textarea"),
      F("agenda4", "วาระ ๔ เรื่องเสนอให้พิจารณา", "textarea"),
      F("agenda5", "วาระ ๕ เรื่องอื่น ๆ", "textarea"),
    ],
  },
  {
    id: "meeting_minutes",
    name: "รายงานการประชุม",
    description: "บันทึกความเห็นและมติของที่ประชุม ตามระเบียบวาระ ๕ ข้อ",
    category: "official",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: meetingMinutesHtml,
    fields: [
      F("meeting_topic", "หัวข้อ", "text", { required: true }),
      F("meeting_no", "ครั้งที่", "text", { required: true }),
      F("year", "พ.ศ.", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("meeting_date", "วันที่ประชุม", "date", { required: true }),
      F("meeting_time", "เวลาเริ่ม (หัวเรื่อง)", "text"),
      F("meeting_place", "สถานที่"),
      F("attendees", "ผู้มาประชุม", "textarea"),
      F("absentees", "ผู้ไม่มาประชุม", "textarea"),
      F("guests", "ผู้เข้าร่วม", "textarea"),
      F("start_time", "เริ่มประชุมเวลา", "text"),
      F("agenda1", "วาระ ๑", "textarea"),
      F("agenda2", "วาระ ๒", "textarea"),
      F("agenda3", "วาระ ๓", "textarea"),
      F("agenda4", "วาระ ๔ เรื่องพิจารณา", "textarea"),
      F("agenda4_result", "มติที่ประชุม วาระ ๔"),
      F("agenda5", "วาระ ๕ อื่น ๆ", "textarea"),
      F("end_time", "เลิกประชุมเวลา", "text"),
      F("signature", "ลายเซ็น", "signature"),
      F("recorder_name", "ผู้จดรายงาน", "autofill", { autofillSource: "user.name" }),
    ],
  },

  // ---------- ใบปกเอกสารลับ ----------
  ...(["ลับ", "ลับมาก", "ลับที่สุด"].map((label, idx) => ({
    id: `classified_cover_${idx + 1}`,
    name: `ใบปกเอกสาร${label}`,
    description: `ใบปกชั้นความลับ "${label}" ใช้ปิดทับข้อมูลข่าวสารลับ`,
    category: "official" as const,
    page_size: "A4" as const,
    font_family: "Sarabun",
    font_size_pt: 20,
    content_html: classifiedCover(label),
    fields: [
      F("subject", "เรื่อง"),
      F("doc_no", "เลขที่"),
      F("school_name", "ส่วนราชการ", "autofill", { autofillSource: "school.name" }),
    ],
  }))),

  // ---------- วิชาการ (ปพ.) ----------
  {
    id: "pp5_cover",
    name: "ปพ.๕ หน้าปก",
    description: "หน้าปกแบบบันทึกผลการพัฒนาคุณภาพผู้เรียน รายวิชา ตามหลักสูตรแกนกลางฯ ๒๕๕๑",
    category: "academic",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 18,
    content_html: pp5CoverHtml,
    fields: [
      F("subject_code", "รหัสวิชา", "text", { required: true }),
      F("subject_name", "ชื่อวิชา", "text", { required: true }),
      F("learning_area", "กลุ่มสาระการเรียนรู้", "select", { options: ["ภาษาไทย", "คณิตศาสตร์", "วิทยาศาสตร์และเทคโนโลยี", "สังคมศึกษา ศาสนาและวัฒนธรรม", "สุขศึกษาและพลศึกษา", "ศิลปะ", "การงานอาชีพ", "ภาษาต่างประเทศ"] }),
      F("grade", "ชั้น", "text", { required: true }),
      F("semester", "ภาคเรียน", "select", { options: ["๑", "๒"] }),
      F("year", "ปีการศึกษา", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("teacher_name", "ชื่อครูผู้สอน", "autofill", { autofillSource: "user.name" }),
      F("teacher_position", "ตำแหน่ง", "autofill", { autofillSource: "user.position" }),
      F("school_name", "ชื่อโรงเรียน", "autofill", { autofillSource: "school.name" }),
      F("area", "เขตพื้นที่การศึกษา"),
    ],
  },
  {
    id: "pp6_cover",
    name: "ปพ.๖ หน้าปก",
    description: "แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล",
    category: "academic",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 18,
    content_html: pp6CoverHtml,
    fields: [
      F("student_name", "ชื่อ-สกุลนักเรียน", "text", { required: true }),
      F("student_code", "เลขประจำตัวนักเรียน", "text", { required: true }),
      F("national_id", "เลขประจำตัวประชาชน"),
      F("grade", "ชั้น", "text", { required: true }),
      F("room", "ห้อง"),
      F("year", "ปีการศึกษา", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("advisor_name", "ครูที่ปรึกษา"),
      F("school_name", "ชื่อโรงเรียน", "autofill", { autofillSource: "school.name" }),
      F("area", "เขตพื้นที่การศึกษา"),
    ],
  },
  {
    id: "pp7",
    name: "ปพ.๗ ใบรับรองผลการเรียน",
    description: "ใบรับรองสถานภาพ/ผลการเรียนของนักเรียน",
    category: "academic",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 16,
    content_html: pp7Html,
    fields: [
      F("cert_no", "เลขที่", "text", { required: true }),
      F("school_name", "ชื่อโรงเรียน", "autofill", { autofillSource: "school.name" }),
      F("student_name", "ชื่อ-สกุลนักเรียน", "text", { required: true }),
      F("student_code", "เลขประจำตัวนักเรียน", "text", { required: true }),
      F("national_id", "เลขประจำตัวประชาชน"),
      F("birth_date", "วันเกิด", "date"),
      F("semester", "ภาคเรียน", "select", { options: ["๑", "๒"] }),
      F("year", "ปีการศึกษา", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("grade", "ชั้น", "text", { required: true }),
      F("gpa", "ผลการเรียนเฉลี่ย (GPA)", "number"),
      F("conduct", "ความประพฤติ", "select", { options: ["ดีเยี่ยม", "ดี", "ผ่าน"] }),
      F("issue_date", "วันที่ออก", "autofill", { autofillSource: "today_thai" }),
      F("signature", "ลายเซ็น ผอ.", "signature"),
      F("director_name", "ชื่อ ผอ.", "autofill", { autofillSource: "director.name" }),
      F("director_title", "ตำแหน่ง", "autofill", { autofillSource: "director.title" }),
    ],
  },
  {
    id: "pp8_cover",
    name: "ปพ.๘ ระเบียนสะสม (หน้าปก)",
    description: "ระเบียนสะสมข้อมูลนักเรียนตลอดช่วงชั้น",
    category: "academic",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 18,
    content_html: pp8CoverHtml,
    fields: [
      F("student_name", "ชื่อ-สกุลนักเรียน", "text", { required: true }),
      F("student_code", "เลขประจำตัวนักเรียน", "text", { required: true }),
      F("national_id", "เลขประจำตัวประชาชน"),
      F("birth_date", "วัน/เดือน/ปีเกิด", "date"),
      F("entry_grade", "ชั้นแรกเข้า"),
      F("entry_year", "ปีที่เข้าเรียน"),
      F("school_name", "ชื่อโรงเรียน", "autofill", { autofillSource: "school.name" }),
      F("area", "เขตพื้นที่การศึกษา"),
    ],
  },
  {
    id: "pp9_cover",
    name: "ปพ.๙ สมุดบันทึกผลการเรียน (หน้าปก)",
    description: "สมุดบันทึกผลการเรียนรายปี/ภาคเรียน",
    category: "academic",
    page_size: "A4", font_family: "Sarabun", font_size_pt: 18,
    content_html: pp9CoverHtml,
    fields: [
      F("student_name", "ชื่อ-สกุลนักเรียน", "text", { required: true }),
      F("student_code", "เลขประจำตัวนักเรียน", "text", { required: true }),
      F("grade", "ชั้น", "text", { required: true }),
      F("year", "ปีการศึกษา", "text", { defaultValue: String(new Date().getFullYear() + BE_OFFSET) }),
      F("school_name", "ชื่อโรงเรียน", "autofill", { autofillSource: "school.name" }),
      F("area", "เขตพื้นที่การศึกษา"),
    ],
  },
];

const OFFICIAL_PRESET_NAME_TO_ID: Record<string, string> = {
  "แบบ ๑ หนังสือภายนอก": "external_letter",
  "แบบ ๑ — หนังสือภายนอก": "external_letter",
  "แบบ ๒ บันทึกข้อความ": "memo",
  "แบบ ๒ — บันทึกข้อความ": "memo",
  "แบบ ๓ หนังสือประทับตรา": "stamped_letter",
  "แบบ ๓ — หนังสือประทับตรา": "stamped_letter",
  "แบบ ๔ คำสั่ง": "school_order",
  "แบบ ๔ — คำสั่ง": "school_order",
  "แบบ ๕ ระเบียบ": "regulation",
  "แบบ ๕ — ระเบียบ": "regulation",
  "แบบ ๖ ข้อบังคับ": "rules",
  "แบบ ๖ — ข้อบังคับ": "rules",
  "แบบ ๗ ประกาศ": "announcement",
  "แบบ ๗ — ประกาศ": "announcement",
  "แบบ ๘ แถลงการณ์": "statement",
  "แบบ ๘ — แถลงการณ์": "statement",
  "แบบ ๙ ข่าว": "news_royal",
  "แบบ ๙ — ข่าว": "news_royal",
  "แบบ ๑๐ หนังสือรับรอง": "certificate_official",
  "แบบ ๑๐ — หนังสือรับรอง": "certificate_official",
  "หนังสือเชิญประชุม": "meeting_invite",
  "ระเบียบวาระการประชุม": "meeting_agenda",
  "รายงานการประชุม": "meeting_minutes",
  "ใบปกเอกสารลับ": "classified_cover_1",
  "ใบปกเอกสารลับมาก": "classified_cover_2",
  "ใบปกเอกสารลับที่สุด": "classified_cover_3",
};

export const applyCurrentOfficialPreset = (template: EFormTemplateRow): EFormTemplateRow => {
  const presetId = OFFICIAL_PRESET_NAME_TO_ID[template.name];
  const preset = presetId ? EFORM_PRESETS.find((p) => p.id === presetId) : null;
  if (!preset) return template;
  // ไม่เขียนทับเอกสารที่ผู้ดูแลแก้ไขแล้ว — ใช้ preset เฉพาะเมื่อ content_html ยังเป็นค่าเดิมจาก preset เท่านั้น
  const isCustomized = template.content_html && template.content_html.trim() && template.content_html !== preset.content_html;
  if (isCustomized) return template;
  return {
    ...template,
    name: preset.name,
    description: preset.description,
    category: preset.category,
    content_html: preset.content_html,
    fields: preset.fields,
    page_size: preset.page_size,
    font_family: preset.font_family,
    font_size_pt: preset.font_size_pt,
  };
};

export const PRESET_CATEGORIES = [
  { id: "all", label: "ทั้งหมด" },
  { id: "official", label: "ราชการ (แบบ ๑-๑๐)" },
  { id: "personnel", label: "บุคลากร" },
  { id: "academic", label: "วิชาการ (ปพ.)" },
  { id: "student", label: "นักเรียน" },
];
