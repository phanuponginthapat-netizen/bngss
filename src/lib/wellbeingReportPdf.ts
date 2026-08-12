import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { registerThaiFont } from "@/lib/jspdfThai";

export interface WellbeingPdfInput {
  schoolName?: string;
  scopeLabel: string;
  stats: { label: string; value: number }[];
  chartNodes: { title: string; node: HTMLElement | null }[];
  classroomRows: { name: string; participants: number; assessments: number; career: number; atRisk: number }[];
  riskRows: { name: string; value: number }[];
  toolRows: { tool: string; total: number; watch: number }[];
  atRiskRows: { name: string; classroom: string; tool: string; score: number | string; risk: string; date: string }[];
}

const captureNode = async (node: HTMLElement) => {
  const canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
  });
  return canvas.toDataURL("image/png");
};

export async function generateWellbeingReportPdf(input: WellbeingPdfInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await registerThaiFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(20);
  doc.text(input.schoolName || "รายงานสรุปผลสุขภาพจิตและแววอาชีพนักเรียน", pageW / 2, y + 6, { align: "center" });
  y += 10;
  doc.setFontSize(15);
  doc.text("สรุปผลรายชั้น / รายกลุ่ม", pageW / 2, y + 5, { align: "center" });
  y += 9;

  doc.setFont("THSarabunNew", "normal");
  doc.setFontSize(13);
  const printed = new Date();
  const printedTh = `${printed.toLocaleDateString("th-TH", { day: "2-digit", month: "long", year: "numeric" })} ${printed.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
  doc.text(`ขอบเขตข้อมูล: ${input.scopeLabel}`, margin, y + 4);
  y += 6;
  doc.text(`พิมพ์เมื่อ: ${printedTh}`, margin, y + 4);
  y += 8;

  // สรุปตัวเลขรวม
  autoTable(doc, {
    startY: y,
    head: [input.stats.map((s) => s.label)],
    body: [input.stats.map((s) => String(s.value))],
    styles: { font: "THSarabunNew", fontSize: 13, halign: "center", cellPadding: 2 },
    headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [37, 99, 235], textColor: 255, fontSize: 12 },
    margin: { left: margin, right: margin },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // กราฟ
  for (const chart of input.chartNodes) {
    if (!chart.node) continue;
    let dataUrl: string;
    try {
      dataUrl = await captureNode(chart.node);
    } catch {
      continue;
    }
    const props = doc.getImageProperties(dataUrl);
    const w = pageW - margin * 2;
    const h = (props.height / props.width) * w;
    ensureSpace(h + 10);
    doc.setFont("THSarabunNew", "bold");
    doc.setFontSize(14);
    doc.text(chart.title, margin, y + 4);
    y += 6;
    doc.addImage(dataUrl, "PNG", margin, y, w, h);
    y += h + 6;
  }

  const table = (title: string, head: string[], body: (string | number)[][]) => {
    if (body.length === 0) return;
    ensureSpace(24);
    doc.setFont("THSarabunNew", "bold");
    doc.setFontSize(14);
    doc.text(title, margin, y + 4);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [head],
      body: body.map((r) => r.map(String)),
      styles: { font: "THSarabunNew", fontSize: 12, cellPadding: 1.8 },
      headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [244, 247, 252] },
      margin: { left: margin, right: margin },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };

  table(
    "ตารางสรุปรายชั้นเรียน",
    ["ห้องเรียน", "ผู้เข้าร่วม", "ครั้งที่ประเมิน", "วัดแววอาชีพ", "เฝ้าระวัง"],
    input.classroomRows.map((c) => [c.name, c.participants, c.assessments, c.career, c.atRisk]),
  );

  table(
    "สัดส่วนระดับความเสี่ยงด้านสุขภาพจิต",
    ["ระดับความเสี่ยง", "จำนวน (ครั้ง)"],
    input.riskRows.map((r) => [r.name, r.value]),
  );

  table(
    "จำนวนการประเมินแยกตามเครื่องมือ",
    ["เครื่องมือ", "ทั้งหมด", "เฝ้าระวัง"],
    input.toolRows.map((t) => [t.tool, t.total, t.watch]),
  );

  table(
    "รายชื่อนักเรียนกลุ่มเฝ้าระวัง",
    ["ชื่อ-สกุล", "ห้องเรียน", "เครื่องมือ", "คะแนน", "ระดับ", "วันที่"],
    input.atRiskRows.map((r) => [r.name, r.classroom, r.tool, r.score, r.risk, r.date]),
  );

  // เลขหน้า
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("THSarabunNew", "normal");
    doc.setFontSize(11);
    doc.text(`หน้า ${i}/${total}`, pageW - margin, pageH - 6, { align: "right" });
  }

  const stamp = `${printed.getFullYear() + 543}${String(printed.getMonth() + 1).padStart(2, "0")}${String(printed.getDate()).padStart(2, "0")}`;
  doc.save(`wellbeing-report-${stamp}.pdf`);
}
