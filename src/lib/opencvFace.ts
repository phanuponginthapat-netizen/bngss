/**
 * OpenCV.js Haar-cascade face detector (โหลดแบบ lazy จาก CDN)
 * ใช้เป็นตัวช่วยหาใบหน้าเมื่อ face-api ตรวจไม่เจอ + วาด overlay สไตล์ OpenCV
 * ทำงานฝั่งเบราว์เซอร์เท่านั้น
 */

const OPENCV_URL = "https://docs.opencv.org/4.10.0/opencv.js";
const CASCADE_URL =
  "https://cdn.jsdelivr.net/gh/opencv/opencv@4.x/data/haarcascades/haarcascade_frontalface_default.xml";
const CASCADE_FILE = "haarcascade_frontalface_default.xml";

export interface CVBox { x: number; y: number; width: number; height: number }

/* eslint-disable @typescript-eslint/no-explicit-any */
type CV = any;

let cvPromise: Promise<CV | null> | null = null;
let classifier: CV | null = null;
let scratch: { src: CV; gray: CV; w: number; h: number } | null = null;

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-opencv="1"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.opencv = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("โหลด opencv.js ไม่สำเร็จ"));
    document.head.appendChild(s);
  });

/** โหลด opencv.js + haar cascade (เรียกซ้ำได้ ปลอดภัย) */
export const loadOpenCV = (): Promise<CV | null> => {
  if (cvPromise) return cvPromise;
  cvPromise = (async () => {
    try {
      await loadScript(OPENCV_URL);
      const cv: CV = await new Promise((resolve, reject) => {
        const started = Date.now();
        const check = () => {
          const g = (window as any).cv;
          if (g && (g.Mat || g.then)) {
            if (typeof g.then === "function") { g.then(resolve).catch(reject); return; }
            if (g.Mat) { resolve(g); return; }
          }
          if (Date.now() - started > 30000) { reject(new Error("opencv.js timeout")); return; }
          setTimeout(check, 120);
        };
        check();
      });

      const buf = new Uint8Array(await (await fetch(CASCADE_URL)).arrayBuffer());
      try { cv.FS_unlink(CASCADE_FILE); } catch { /* ไฟล์ยังไม่มี */ }
      cv.FS_createDataFile("/", CASCADE_FILE, buf, true, false, false);
      const cls = new cv.CascadeClassifier();
      if (!cls.load(CASCADE_FILE)) throw new Error("โหลด cascade ไม่สำเร็จ");
      classifier = cls;
      return cv;
    } catch {
      cvPromise = null;
      return null;
    }
  })();
  return cvPromise;
};

export const isOpenCVReady = () => !!classifier;

/** ตรวจจับใบหน้าจาก video ด้วย Haar cascade — คืนกล่องในพิกัดของวิดีโอจริง */
export const detectFacesCV = (video: HTMLVideoElement, maxWidth = 320): CVBox[] => {
  const cv: CV = (window as any).cv;
  if (!cv || !classifier || !video.videoWidth) return [];
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(video, 0, 0, w, h);

  if (!scratch || scratch.w !== w || scratch.h !== h) {
    scratch?.src.delete(); scratch?.gray.delete();
    scratch = { src: new cv.Mat(h, w, cv.CV_8UC4), gray: new cv.Mat(), w, h };
  }
  const { src, gray } = scratch;
  src.data.set(ctx.getImageData(0, 0, w, h).data);
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.equalizeHist(gray, gray);

  const faces = new cv.RectVector();
  const out: CVBox[] = [];
  try {
    classifier.detectMultiScale(gray, faces, 1.15, 3, 0, new cv.Size(Math.round(h * 0.15), Math.round(h * 0.15)));
    for (let i = 0; i < faces.size(); i++) {
      const r = faces.get(i);
      out.push({ x: r.x / scale, y: r.y / scale, width: r.width / scale, height: r.height / scale });
    }
  } catch { /* ข้ามเฟรมที่ตรวจไม่ได้ */ } finally {
    faces.delete();
  }
  return out.sort((a, b) => b.width * b.height - a.width * a.height);
};

export const disposeOpenCV = () => {
  scratch?.src.delete(); scratch?.gray.delete(); scratch = null;
};
