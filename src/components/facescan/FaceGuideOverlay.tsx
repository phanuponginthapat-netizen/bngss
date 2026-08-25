import { useEffect, useRef } from "react";
import { detectFaceBox } from "@/lib/faceApi";
import { faceGuideStatus } from "@/lib/faceGuide";

/**
 * Overlay นำทางระยะใบหน้า (Face Guide)
 * - วาดวงรีเป้าหมายที่ใบหน้าควรอยู่ (กลางจอ, ขนาดที่ถูกต้องตามระยะ)
 * - ตรวจจับใบหน้าจริงแบบ live (เฉพาะกล่อง ไม่คำนวณ ArcFace → เบา) แล้ววาดกรอบทับ
 * - เปรียบเทียบตำแหน่ง/ขนาด → แสดงคำแนะนำ "เข้าใกล้ / ถอย / เลื่อนซ้าย-ขวา-บน-ล่าง"
 * ใช้ได้ทั้งหน้า register และ scan เพื่อให้กะระยะแม่นยำขึ้น
 */

interface FaceGuideOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: boolean;
  /** สัดส่วนใบหน้าเป้าหมายต่อความกว้างวิดีโอ เช่น 0.32 = หน้ากว้าง ~32% ของจอ */
  targetRatio?: number;
  /** ข้อความเหนือกรอบ (เช่น ชื่อขั้นตอน) */
  topLabel?: string;
  /** ขนาดตัวอักษรในหน่วย px ของจอ 480 กว้าง */
  fontSize?: number;
  /** วิดีโอถูกแสดงด้วย object-cover (crop) หรือ object-contain (เต็มความกว้าง) */
  fit?: "contain" | "cover";
  /** กล้องหน้าถูก mirror ด้วย CSS (scaleX(-1)) → ต้องพลิกกรอบใบหน้าจริง */
  mirror?: boolean;
}

export default function FaceGuideOverlay({ videoRef, active, targetRatio = 0.32, topLabel, fontSize = 14, fit = "contain", mirror = false }: FaceGuideOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectRef = useRef(0);
  const fitRef = useRef(fit);
  const mirrorRef = useRef(mirror);
  fitRef.current = fit;
  mirrorRef.current = mirror;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const draw = async () => {
      if (cancelled) return;
      const v = videoRef.current;
      const cv = canvasRef.current;
      if (!v || !cv || v.readyState < 2) {
        rafRef.current = window.requestAnimationFrame(draw);
        return;
      }
      const vw = v.videoWidth, vh = v.videoHeight;
      if (!vw || !vh) {
        rafRef.current = window.requestAnimationFrame(draw);
        return;
      }
      // ปรับขนาด canvas ให้ตรงกับ CSS ของ container
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cwCss = cv.clientWidth || vw;
      const chCss = cv.clientHeight || vh;
      const cw = Math.round(cwCss * dpr);
      const ch = Math.round(chCss * dpr);
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      const ctx = cv.getContext("2d");
      if (!ctx) {
        rafRef.current = window.requestAnimationFrame(draw);
        return;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      const unitG = Math.max(1, cw / 480);

      // ---- วงรีเป้าหมาย (กลางจอ) — เป็น "ที่ใบหน้าควรอยู่" ----
      const targetW = cw * targetRatio;
      const targetH = targetW * 1.35;
      const cx = cw / 2, cy = ch * 0.46;
      let status = { text: "รอใบหน้า...", color: "rgba(255,255,255,0.45)", ok: false };

      // ---- ตรวจจับใบหน้าจริงแบบ live (throttle ~300ms — ลด CPU บน Pavilion x2) ----
      const now = performance.now();
      if (now - lastDetectRef.current > 300) {
        lastDetectRef.current = now;
        const det = await detectFaceBox(v);
        if (cancelled) return;
        if (det) {
          // แมปพิกัดวิดีโอ → พิกัด canvas CSS ให้ตรงกับ object-contain / object-cover
          const scale = fitRef.current === "cover" ? Math.max(cw / vw, ch / vh) : Math.min(cw / vw, ch / vh);
          const offX = (cw - vw * scale) / 2;
          const offY = (ch - vh * scale) / 2;
          let box = { x: det.box.x * scale + offX, y: det.box.y * scale + offY, width: det.box.width * scale, height: det.box.height * scale };
          if (mirrorRef.current) box = { ...box, x: cw - box.x - box.width };
          const s = faceGuideStatus(box, { cx, cy, w: targetW, h: targetH });
          status = s.ok ? { text: s.text, color: "#22c55e", ok: true } : { text: s.text, color: s.color, ok: false };

          // กรอบใบหน้าจริง
          ctx.save();
          ctx.strokeStyle = status.color;
          ctx.lineWidth = 2 * unitG;
          ctx.setLineDash([6 * unitG, 4 * unitG]);
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          ctx.setLineDash([]);
          // จุดศูนย์กลางใบหน้า
          ctx.beginPath();
          ctx.arc(box.x + box.width / 2, box.y + box.height / 2, 3 * unitG, 0, Math.PI * 2);
          ctx.fillStyle = status.color;
          ctx.fill();
          ctx.restore();
        }
      }

      // ---- วงรีเป้า ----
      ctx.save();
      ctx.setLineDash(status.ok ? [] : [10 * unitG, 8 * unitG]);
      ctx.lineWidth = (status.ok ? 3 : 2) * unitG;
      ctx.strokeStyle = status.ok ? "rgba(34,197,94,0.95)" : status.color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, targetW / 2, targetH / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (status.ok) {
        ctx.shadowColor = "rgba(34,197,94,0.8)";
        ctx.shadowBlur = 18 * unitG;
        ctx.stroke();
      }
      ctx.restore();

      // ---- ข้อความ ----
      if (topLabel) {
        ctx.font = `600 ${Math.round(fontSize * 0.85) * unitG}px 'IBM Plex Sans Thai', system-ui, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.textAlign = "center";
        ctx.fillText(topLabel, cw / 2, 18 * unitG);
      }
      ctx.font = `600 ${fontSize * unitG}px 'IBM Plex Sans Thai', system-ui, sans-serif`;
      ctx.textAlign = "center";
      const tw = ctx.measureText(status.text).width + 24 * unitG;
      const th = 30 * unitG;
      const tx = cw / 2;
      const ty = ch - 34 * unitG;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(tx - tw / 2, ty - th / 2, tw, th, 8 * unitG);
      ctx.fill();
      ctx.fillStyle = status.color;
      ctx.fillText(status.text, tx, ty + 4 * unitG);

      rafRef.current = window.requestAnimationFrame(draw);
    };

    rafRef.current = window.requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, videoRef, targetRatio, topLabel, fontSize]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}