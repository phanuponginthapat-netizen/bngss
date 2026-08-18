/**
 * คำนวณสถานะการวางใบหน้า เทียบกับวงรีเป้าหมาย (ใช้ใน FaceGuideOverlay + หน้าสแกน)
 * คืนข้อความแนะนำ เช่น "เข้าใกล้กล้อง" / "ถอยห่างออกไป" / "เลื่อนซ้าย" / "ตำแหน่งถูกต้อง"
 */

export interface GuideTarget {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export function faceGuideStatus(
  box: { x: number; y: number; width: number; height: number },
  target: GuideTarget,
): { text: string; color: string; ok: boolean } {
  const faceW = box.width;
  const faceH = box.height;
  const faceCx = box.x + box.width / 2;
  const faceCy = box.y + box.height / 2;

  const sizeOk = faceW >= target.w * 0.78 && faceW <= target.w * 1.30 && faceH >= target.h * 0.78 && faceH <= target.h * 1.30;
  const dx = faceCx - target.cx;
  const dy = faceCy - target.cy;
  const posOk = Math.abs(dx) <= target.w * 0.22 && Math.abs(dy) <= target.h * 0.22;

  if (sizeOk && posOk) return { text: "ตำแหน่งถูกต้อง ✓", color: "#22c55e", ok: true };

  const dirs: string[] = [];
  if (faceW < target.w * 0.78 || faceH < target.h * 0.78) dirs.push("เข้าใกล้กล้อง");
  else if (faceW > target.w * 1.30 || faceH > target.h * 1.30) dirs.push("ถอยห่างออกไป");
  if (Math.abs(dx) > target.w * 0.22) dirs.push(dx > 0 ? "เลื่อนซ้าย" : "เลื่อนขวา");
  if (Math.abs(dy) > target.h * 0.22) dirs.push(dy > 0 ? "เลื่อนขึ้น" : "เลื่อนลง");

  return { text: dirs.join(" • ") || "ปรับตำแหน่งใบหน้า", color: dirs.some((d) => d.startsWith("เข้า") || d.startsWith("ถอย")) ? "#f59e0b" : "#60a5fa", ok: false };
}