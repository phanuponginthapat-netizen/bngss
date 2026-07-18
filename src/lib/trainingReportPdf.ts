import jsPDF from "jspdf";
import { registerThaiFont } from "@/lib/jspdfThai";
import { supabase } from "@/integrations/supabase/client";

export interface TrainingReportData {
  schoolName: string;
  directorName: string;
  orderType: string;
  orderTypeLabel: string;
  orderNumber: string;
  orderDate: string;
  personName: string;
  position: string;
  assignedTeachers: string[]; // ครูที่ได้รับมอบหมายไปอบรม
  title: string;
  organizer: string;
  startDt: string;
  endDt: string;
  location: string;
  days: string;
  hours: string;
  objectives: string[];
  knowledge: string[];
  applications: string[];
  imagePaths: string[];
  attachmentPaths: string[]; // เอกสาร/รูปแนบเพิ่มเติม
}

const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function fmtBEDate(iso?: string) {
  if (!iso) return "..............................";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function fmtBEDateTime(iso?: string) {
  if (!iso) return "..............................";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fmtBEDate(iso)} เวลา ${hh}.${mm} น.`;
}

async function fetchImageDataUrl(path: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const { data } = await supabase.storage.from("pa-files").createSignedUrl(path, 300);
    if (!data?.signedUrl) return null;
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    return { dataUrl, w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null;
  }
}

export async function generateTrainingReportPdf(d: TrainingReportData): Promise<Blob> {
  // A4: 210 x 297 mm — มาตรฐานหนังสือราชการ ขอบ บน 2.5cm ล่าง 2cm ซ้าย 3cm ขวา 2cm
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerThaiFont(doc);

  const pageW = 210, pageH = 297;
  const marginL = 30, marginR = 20, marginT = 20, marginB = 15;
  const contentW = pageW - marginL - marginR;
  let y = marginT;

  // มาตรฐานหนังสือราชการไทย TH Sarabun: เนื้อหา 16pt, หัวเรื่อง 18pt
  const FS_BODY = 16;
  const FS_BOLD_HEAD = 18;
  const LH = 6;     // line-height แน่นขึ้น ให้พอดี 1 หน้า
  const LH_TIGHT = 5.5;

  const setBody = () => { doc.setFont("THSarabunNew", "normal"); doc.setFontSize(FS_BODY); };
  const setBold = () => { doc.setFont("THSarabunNew", "bold"); doc.setFontSize(FS_BODY); };
  const setHead = () => { doc.setFont("THSarabunNew", "bold"); doc.setFontSize(FS_BOLD_HEAD); };

  const needsNew = (h: number) => { if (y + h > pageH - marginB) { doc.addPage(); y = marginT; } };

  const writeWrapped = (text: string, opts: { indent?: number; bold?: boolean; align?: "left"|"center"|"right" } = {}) => {
    const indent = opts.indent ?? 0;
    if (opts.bold) setBold(); else setBody();
    const lines = doc.splitTextToSize(text, contentW - indent);
    for (const ln of lines) {
      needsNew(LH);
      if (opts.align === "center") doc.text(ln, pageW / 2, y, { align: "center" });
      else if (opts.align === "right") doc.text(ln, pageW - marginR, y, { align: "right" });
      else doc.text(ln, marginL + indent, y);
      y += LH;
    }
  };

  // === HEADER: บันทึกข้อความ ===
  setHead();
  doc.text("บันทึกข้อความ", pageW / 2, y, { align: "center" });
  y += 8;

  // ส่วนราชการ
  setBold();
  doc.text("ส่วนราชการ", marginL, y);
  setBody();
  doc.text(d.schoolName || "................................................", marginL + 24, y);
  y += LH;

  // ที่ ........ วันที่ ........
  setBold(); doc.text("ที่", marginL, y);
  setBody(); doc.text("............................................", marginL + 8, y);
  setBold(); doc.text("วันที่", marginL + 95, y);
  setBody(); doc.text(fmtBEDate(new Date().toISOString()), marginL + 110, y);
  y += LH;

  // เรื่อง
  setBold(); doc.text("เรื่อง", marginL, y);
  setBody(); doc.text("รายงานผลการอบรม ประชุม สัมมนา ศึกษาดูงาน", marginL + 14, y);
  y += 2;
  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageW - marginR, y);
  y += 5;

  // เรียน
  setBold(); doc.text("เรียน", marginL, y);
  setBody(); doc.text(`ผู้อำนวยการ${d.schoolName || ""}`, marginL + 14, y);
  y += LH + 1;

  // ===== ย่อหน้าที่ 1: อ้างอิงคำสั่ง =====
  const orderRef = d.orderTypeLabel || "................................";
  const para1 =
    `ตามหนังสือ${orderRef} ที่ ${d.orderNumber || "................"} ` +
    `ลงวันที่ ${fmtBEDate(d.orderDate)} ได้แจ้งให้โรงเรียนส่ง ` +
    `${d.personName || "................"} ` +
    `เข้ารับการอบรมหลักสูตร/เรื่อง "${d.title}" ` +
    `จัดโดย ${d.organizer || "................"} ` +
    `เมื่อวันที่ ${fmtBEDateTime(d.startDt)}` +
    `${d.endDt ? ` ถึง ${fmtBEDateTime(d.endDt)}` : ""} ` +
    `รวมระยะเวลา ${d.days || "-"} วัน ${d.hours || "-"} ชั่วโมง ` +
    `ณ ${d.location || "................"} นั้น`;
  writeWrapped("            " + para1);
  y += 1;

  // ===== ครูที่ได้รับมอบหมาย =====
  if (d.assignedTeachers.length > 0) {
    const teachers = d.assignedTeachers.filter(Boolean);
    const list = teachers.map((t, i) => `${i + 1}) ${t}`).join("  ");
    writeWrapped(
      `            ครูที่ได้รับมอบหมายให้เข้าร่วมการอบรม จำนวน ${teachers.length} คน ได้แก่ ${list}`
    );
    y += 1;
  }

  // ===== ย่อหน้าที่ 2: ข้าพเจ้า =====
  writeWrapped(
    `            ข้าพเจ้า ${d.personName || "................"} ` +
    `ตำแหน่ง ${d.position || "................"} ` +
    `ได้เข้ารับการอบรม/ประชุม/สัมมนา/ศึกษาดูงาน ในวัน เวลา ที่กำหนด ` +
    `ในการอบรมครั้งนี้มีรายละเอียดดังนี้`
  );
  y += 2;

  // ===== 6. วัตถุประสงค์ =====
  writeWrapped("วัตถุประสงค์ของการเข้ารับการอบรม", { bold: true });
  d.objectives.forEach((o, i) => writeWrapped(`${i + 1}. ${o}`, { indent: 8 }));
  y += 1;

  // ===== 7. องค์ความรู้ =====
  writeWrapped("สรุปองค์ความรู้ในการเข้ารับการอบรม", { bold: true });
  d.knowledge.forEach((o, i) => writeWrapped(`${i + 1}. ${o}`, { indent: 8 }));
  y += 1;

  // ===== 8. การนำไปประยุกต์ใช้ =====
  writeWrapped("การนำไปประยุกต์ใช้ในการปฏิบัติงานในโรงเรียน", { bold: true });
  d.applications.forEach((o, i) => writeWrapped(`${i + 1}. ${o}`, { indent: 8 }));
  y += 2;

  writeWrapped("            จึงเรียนมาเพื่อโปรดทราบ");
  y += 6;

  // ===== ลงนามผู้รายงาน — บังคับให้อยู่หน้าเดียวกับเนื้อหา =====
  // ไม่เรียก needsNew เพื่อให้บีบลงในหน้าเดียวกัน
  const sigX = pageW - marginR - 75;
  setBody();
  doc.text("ลงชื่อ ............................................................", sigX, y); y += LH;
  doc.text(`( ${d.personName || "....................................."} )`, sigX + 8, y); y += LH;
  doc.text(`ตำแหน่ง ${d.position || "................................"}`, sigX, y); y += LH + 3;

  // ===== ความคิดเห็นผู้อำนวยการ =====
  setBold(); doc.text("ความคิดเห็นผู้อำนวยการ", marginL, y); y += LH;
  setBody();
  doc.text("...........................................................................................................................", marginL, y); y += LH;
  doc.text("...........................................................................................................................", marginL, y); y += LH + 3;

  doc.text("ลงชื่อ ............................................................", sigX, y); y += LH;
  doc.text(`( ${d.directorName || "....................................."} )`, sigX + 8, y); y += LH;
  doc.text(`ตำแหน่ง ผู้อำนวยการ${d.schoolName || "................"}`, sigX, y); y += LH;

  // ===== ภาคผนวก: รูปภาพ + ไฟล์แนบ =====
  const allMedia = [...d.imagePaths, ...d.attachmentPaths];
  if (allMedia.length > 0) {
    doc.addPage(); y = marginT;
    setHead();
    doc.text("ภาคผนวก", pageW / 2, y, { align: "center" }); y += 8;
    setBody();
    doc.text("(รูปภาพ/เอกสารประกอบการอบรม)", pageW / 2, y, { align: "center" }); y += 8;

    const imgs = await Promise.all(allMedia.map((p) => fetchImageDataUrl(p)));
    const cols = 2;
    const gap = 6;
    const cellW = (contentW - gap) / cols;
    let col = 0;
    let rowY = y;
    let rowMaxH = 0;
    let nonImageNames: string[] = [];

    for (let idx = 0; idx < imgs.length; idx++) {
      const im = imgs[idx];
      if (!im) {
        const fname = allMedia[idx].split("/").pop() || "ไฟล์แนบ";
        nonImageNames.push(fname);
        continue;
      }
      const maxH = 85;
      const ratio = im.w / im.h;
      let w = cellW, h = cellW / ratio;
      if (h > maxH) { h = maxH; w = maxH * ratio; }
      const x = marginL + col * (cellW + gap) + (cellW - w) / 2;
      if (rowY + h > pageH - marginB) { doc.addPage(); rowY = marginT; col = 0; rowMaxH = 0; }
      const fmt = im.dataUrl.includes("image/png") ? "PNG" : "JPEG";
      try { doc.addImage(im.dataUrl, fmt as any, x, rowY, w, h); } catch { /* ignore */ }
      rowMaxH = Math.max(rowMaxH, h);
      col++;
      if (col >= cols) { col = 0; rowY += rowMaxH + gap; rowMaxH = 0; }
    }

    // รายชื่อไฟล์แนบที่ไม่ใช่รูป
    if (nonImageNames.length > 0) {
      y = (col === 0 ? rowY : rowY + rowMaxH) + 8;
      needsNew(LH);
      setBold(); doc.text("ไฟล์เอกสารประกอบ:", marginL, y); y += LH;
      setBody();
      nonImageNames.forEach((n, i) => {
        needsNew(LH);
        doc.text(`${i + 1}. ${n}`, marginL + 8, y); y += LH;
      });
    }
  }

  return doc.output("blob");
}
