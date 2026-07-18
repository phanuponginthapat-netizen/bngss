import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { registerThaiFont } from "@/lib/jspdfThai";
import { formatDateBE } from "@/lib/dateBE";

type LB = {
  house: { id: string; name: string; color: string; motto?: string | null };
  gold: number; silver: number; bronze: number;
  medalPoints: number; bonusPoints: number; points: number;
  reasoning: string;
};

export async function exportSportsDayReportPdf(opts: {
  meet: any;
  leaderboard: LB[];
  activities: any[];
  participantsByActivity: Record<string, any[]>;
  scores: Record<string, any[]>;
  houses: any[];
  bonuses: any[];
  schoolName?: string;
}) {
  const { meet, leaderboard, activities, houses, bonuses, participantsByActivity, scores, schoolName } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerThaiFont(doc);
  doc.setFont("THSarabunNew", "normal");
  const W = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header band
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, W, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(24);
  doc.text("🏆 รายงานสรุปผลกีฬาสี", W / 2, 14, { align: "center" });
  doc.setFont("THSarabunNew", "normal");
  doc.setFontSize(15);
  doc.text(meet.title || "-", W / 2, 22, { align: "center" });
  doc.setFontSize(11);
  const sub: string[] = [];
  if (schoolName) sub.push(schoolName);
  if (meet.academic_year) sub.push(`ปีการศึกษา ${meet.academic_year}`);
  if (meet.venue) sub.push(meet.venue);
  if (meet.start_date) sub.push(formatDateBE(meet.start_date));
  doc.text(sub.join("  •  "), W / 2, 29, { align: "center" });

  let y = 42;
  doc.setTextColor(20, 20, 20);

  // Stat boxes
  const stats = [
    { label: "คณะสี", value: String(houses.length) },
    { label: "รายการแข่ง", value: String(activities.length) },
    { label: "ประกาศผลแล้ว", value: String(activities.filter((a) => a.results_published).length) },
    { label: "รายการคะแนนพิเศษ", value: String(bonuses.length) },
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

  // Champion podium (top 3)
  if (leaderboard.length > 0) {
    doc.setFont("THSarabunNew", "bold");
    doc.setFontSize(15);
    doc.text("🏆 แชมป์กีฬาสี", margin, y);
    y += 4;
    const labels = ["ชนะเลิศ", "รองชนะเลิศ อันดับ 1", "รองชนะเลิศ อันดับ 2"];
    const podiumHeights = [38, 32, 28];
    const top3 = leaderboard.slice(0, 3);
    const pw = (W - margin * 2 - 6) / 3;
    top3.forEach((r, i) => {
      const x = margin + i * (pw + 3);
      const ph = podiumHeights[i];
      const py = y + 2 + (38 - ph);
      const hex = (r.house.color || "#999").replace("#", "");
      const cr = parseInt(hex.slice(0, 2), 16) || 200;
      const cg = parseInt(hex.slice(2, 4), 16) || 200;
      const cb = parseInt(hex.slice(4, 6), 16) || 200;
      doc.setFillColor(cr, cg, cb);
      doc.roundedRect(x, py, pw, ph, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("THSarabunNew", "bold");
      doc.setFontSize(12);
      doc.text(labels[i], x + 4, py + 7);
      doc.setFontSize(15);
      doc.text(r.house.name, x + 4, py + 14);
      doc.setFont("THSarabunNew", "normal");
      doc.setFontSize(11);
      doc.text(`🥇 ${r.gold}  🥈 ${r.silver}  🥉 ${r.bronze}`, x + 4, py + 21);
      doc.setFont("THSarabunNew", "bold");
      doc.setFontSize(18);
      doc.text(`${r.points} คะแนน`, x + pw - 4, py + ph - 4, { align: "right" });
      doc.setFont("THSarabunNew", "normal");
    });
    y += 46;
  }

  // Leaderboard
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text("ตารางคะแนนรวม (พร้อมเหตุผลการคำนวณ)", margin, y);
  y += 2;
  autoTable(doc, {
    startY: y + 2,
    head: [["อันดับ", "คณะสี", "🥇", "🥈", "🥉", "เหรียญ", "พิเศษ", "รวม"]],
    body: leaderboard.length > 0
      ? leaderboard.flatMap((r, i) => [
          [String(i + 1), r.house.name, String(r.gold), String(r.silver), String(r.bronze),
            String(r.medalPoints), String(r.bonusPoints), String(r.points)],
          [{ content: `เหตุผล: ${r.reasoning}`, colSpan: 8, styles: { fontSize: 10, textColor: [107, 114, 128], fillColor: [248, 250, 252] } as any }],
        ])
      : [["-", "ยังไม่มีคะแนน", "-", "-", "-", "-", "-", "-"]],
    styles: { font: "THSarabunNew", fontSize: 12, cellPadding: 2 },
    headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [220, 38, 38], textColor: 255 },
    columnStyles: {
      0: { halign: "center", cellWidth: 14 },
      2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" },
      5: { halign: "right" }, 6: { halign: "right" },
      7: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  // Per-event medals
  let afterY = (doc as any).lastAutoTable?.finalY || y + 40;
  afterY += 8;
  if (afterY > 240) { doc.addPage(); afterY = 20; }
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(14);
  doc.text("ผลการแข่งขันรายรายการ", margin, afterY);

  const published = activities.filter((a) => a.results_published);
  const eventRows = published.map((a) => {
    const parts = participantsByActivity[a.id] || [];
    const ss = scores[a.id] || [];
    const mode = a.scoring_mode || "points";
    const rows = parts.map((p: any) => ({ p, score: ss.find((s: any) => s.participant_id === p.id)?.score ?? null }))
      .filter((r: any) => r.score != null)
      .sort((x: any, y: any) => mode === "time" ? (x.score - y.score) : (y.score - x.score));
    const medalName = (idx: number) => {
      const hid = rows[idx]?.p?.sports_day_house_id;
      const h = houses.find((x: any) => x.id === hid);
      return h ? h.name : "—";
    };
    return [a.title, medalName(0), medalName(1), medalName(2)];
  });
  autoTable(doc, {
    startY: afterY + 4,
    head: [["รายการ", "🥇 ทอง", "🥈 เงิน", "🥉 ทองแดง"]],
    body: eventRows.length > 0 ? eventRows : [["ยังไม่มีรายการที่ประกาศผล", "—", "—", "—"]],
    styles: { font: "THSarabunNew", fontSize: 12, cellPadding: 2 },
    headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [37, 99, 235], textColor: 255 },
    margin: { left: margin, right: margin },
  });

  // Bonus log
  if (bonuses.length > 0) {
    let by = (doc as any).lastAutoTable?.finalY || afterY + 40;
    by += 8;
    if (by > 240) { doc.addPage(); by = 20; }
    doc.setFont("THSarabunNew", "bold");
    doc.setFontSize(14);
    doc.text("คะแนนพิเศษ", margin, by);
    autoTable(doc, {
      startY: by + 4,
      head: [["วันที่", "คณะสี", "หมวด", "รายละเอียด", "คะแนน"]],
      body: bonuses.map((b: any) => {
        const h = houses.find((x: any) => x.id === b.house_id);
        return [formatDateBE(b.awarded_at), h?.name || "—", b.category, b.description || "—", String(b.points)];
      }),
      styles: { font: "THSarabunNew", fontSize: 12, cellPadding: 2 },
      headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [16, 185, 129], textColor: 255 },
      columnStyles: { 4: { halign: "right", fontStyle: "bold" } },
      margin: { left: margin, right: margin },
    });
  }

  // Footer page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("THSarabunNew", "normal");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`หน้า ${i} / ${total}  •  พิมพ์เมื่อ ${formatDateBE(new Date().toISOString())}`,
      W - margin, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  const safe = (meet.title || "sports-day").replace(/[\\/:*?"<>|]+/g, "_");
  doc.save(`รายงานกีฬาสี_${safe}.pdf`);
}
