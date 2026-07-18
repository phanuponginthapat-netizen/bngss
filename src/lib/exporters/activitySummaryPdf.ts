import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { registerThaiFont } from "@/lib/jspdfThai";
import { formatFullNamePlain } from "@/lib/nameFormat";
import { formatDateBE } from "@/lib/dateBE";

type Ranked = {
  rank: number;
  score: number | null;
  participant: {
    team_name?: string | null;
    bib_no?: string | null;
    student?: {
      prefix?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      student_code?: string | null;
      classrooms?: { name?: string | null } | null;
    };
  };
};

export async function exportActivitySummaryPdf(opts: {
  activity: any;
  ranked: Ranked[];
  participantsCount: number;
  schoolName?: string;
}) {
  const { activity, ranked, participantsCount, schoolName } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerThaiFont(doc);
  doc.setFont("THSarabunNew", "normal");

  const W = doc.internal.pageSize.getWidth();
  const margin = 15;

  // ── Header band ──
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, W, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(22);
  doc.text("รายงานสรุปผลการแข่งขัน / กิจกรรม", W / 2, 14, { align: "center" });
  doc.setFont("THSarabunNew", "normal");
  doc.setFontSize(13);
  if (schoolName) doc.text(schoolName, W / 2, 22, { align: "center" });
  doc.setFontSize(10);
  doc.text(`พิมพ์เมื่อ ${formatDateBE(new Date().toISOString())}`, W - margin, 28, { align: "right" });

  // ── Title block ──
  let y = 42;
  doc.setTextColor(20, 20, 20);
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(20);
  doc.text(activity.title || "-", margin, y);
  y += 7;

  doc.setFont("THSarabunNew", "normal");
  doc.setFontSize(13);
  const meta: string[] = [];
  if (activity.start_at) meta.push(`วันที่: ${formatDateBE(activity.start_at)}`);
  if (activity.location) meta.push(`สถานที่: ${activity.location}`);
  if (activity.category) meta.push(`ประเภท: ${activity.category}`);
  if (activity.status) meta.push(`สถานะ: ${activity.status}`);
  doc.setTextColor(80, 80, 80);
  doc.text(meta.join("   •   "), margin, y);
  y += 8;

  // Stat boxes
  const stats = [
    { label: "ผู้เข้าร่วม", value: String(participantsCount) },
    { label: "ผู้มีคะแนน", value: String(ranked.length) },
    { label: "คะแนนเต็ม", value: String(activity.max_score ?? "-") },
    { label: "รูปแบบ", value: activity.scoring_mode === "time" ? "เวลา" : "คะแนน" },
  ];
  const boxW = (W - margin * 2 - 9) / 4;
  stats.forEach((s, i) => {
    const x = margin + i * (boxW + 3);
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(x, y, boxW, 18, 2, 2, "F");
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(11);
    doc.text(s.label, x + boxW / 2, y + 7, { align: "center" });
    doc.setFont("THSarabunNew", "bold");
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text(s.value, x + boxW / 2, y + 14, { align: "center" });
    doc.setFont("THSarabunNew", "normal");
  });
  y += 24;

  // ── Podium top 3 ──
  if (ranked.length > 0) {
    doc.setFont("THSarabunNew", "bold");
    doc.setFontSize(15);
    doc.setTextColor(17, 24, 39);
    doc.text("🏆 ผู้ชนะการแข่งขัน", margin, y);
    y += 4;
    const medals = ["อันดับ 1", "อันดับ 2", "อันดับ 3"];
    const colors: [number, number, number][] = [
      [253, 224, 71],
      [209, 213, 219],
      [217, 119, 6],
    ];
    const top3 = ranked.slice(0, 3);
    const pw = (W - margin * 2 - 6) / 3;
    top3.forEach((r, i) => {
      const x = margin + i * (pw + 3);
      const py = y + 2;
      const [cr, cg, cb] = colors[i];
      doc.setFillColor(cr, cg, cb);
      doc.roundedRect(x, py, pw, 30, 3, 3, "F");
      doc.setTextColor(60, 60, 60);
      doc.setFont("THSarabunNew", "bold");
      doc.setFontSize(12);
      doc.text(medals[i], x + 4, py + 7);
      doc.setFontSize(14);
      const name = formatFullNamePlain(
        r.participant.student?.prefix,
        r.participant.student?.first_name,
        r.participant.student?.last_name,
      );
      doc.text(doc.splitTextToSize(name, pw - 8), x + 4, py + 14);
      doc.setFont("THSarabunNew", "normal");
      doc.setFontSize(11);
      doc.text(r.participant.student?.classrooms?.name || "-", x + 4, py + 22);
      doc.setFont("THSarabunNew", "bold");
      doc.setFontSize(16);
      doc.text(String(r.score ?? "-"), x + pw - 4, py + 22, { align: "right" });
      doc.setFont("THSarabunNew", "normal");
    });
    y += 38;
  }

  // ── Full leaderboard table ──
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39);
  doc.text("ตารางอันดับทั้งหมด", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y + 2,
    head: [["อันดับ", "เลขที่", "ชื่อ-สกุล", "ห้อง", "ทีม", "คะแนน"]],
    body: ranked.length > 0
      ? ranked.map((r) => [
          String(r.rank),
          r.participant.bib_no || "-",
          formatFullNamePlain(
            r.participant.student?.prefix,
            r.participant.student?.first_name,
            r.participant.student?.last_name,
          ),
          r.participant.student?.classrooms?.name || "-",
          r.participant.team_name || "-",
          String(r.score ?? "-"),
        ])
      : [["-", "-", "ยังไม่มีผลคะแนน", "-", "-", "-"]],
    styles: { font: "THSarabunNew", fontSize: 12, cellPadding: 2.5 },
    headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "center", cellWidth: 16 },
      1: { halign: "center", cellWidth: 18 },
      5: { halign: "right", cellWidth: 22, fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  // ── Rules section ──
  if (activity.rules) {
    let afterY = (doc as any).lastAutoTable?.finalY || y + 40;
    afterY += 8;
    if (afterY > 250) { doc.addPage(); afterY = 20; }
    doc.setFont("THSarabunNew", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text("กฎ / กติกาการแข่งขัน", margin, afterY);
    doc.setFont("THSarabunNew", "normal");
    doc.setFontSize(12);
    doc.setTextColor(55, 65, 81);
    const lines = doc.splitTextToSize(activity.rules, W - margin * 2);
    doc.text(lines, margin, afterY + 6);
  }

  // ── Footer with page numbers ──
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("THSarabunNew", "normal");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`หน้า ${i} / ${total}`, W - margin, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  const safe = (activity.title || "activity").replace(/[\\/:*?"<>|]+/g, "_");
  doc.save(`สรุปผล_${safe}.pdf`);
}
