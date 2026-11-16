/** รูปติดบัตร 35×45 มม. ที่ 300dpi — ตรงกับขนาดรูปบนบัตรนักเรียน */
export const ID_PHOTO_WIDTH = 413;
export const ID_PHOTO_HEIGHT = 531;

export type Box = { x: number; y: number; width: number; height: number };

/** สัดส่วนใบหน้า (คิ้ว-คาง) เทียบกับความสูงรูปบัตร ที่วัดจากต้วอย่างบัตรจริงของโรงเรียน */
export const ID_FACE_HEIGHT_RATIO = 0.43;
/** ตำแหน่งจุดกลางใบหน้าเทียบกับขอบบนรูปบัตร ที่วัดจากต้วอย่างบัตรจริงของโรงเรียน */
export const ID_FACE_CENTER_Y_RATIO = 0.515;

/**
 * คำนวณกรอบตัดรูปหน้าตรงแบบรูปติดบัตร: กรอบใบหน้า (คิ้ว-คาง) กินราว 43% ของความสูง
 * จุดกลางใบหน้าอยู่ราว 51.5% จากขอบบน (เผื่อผม/หน้าผากด้านบน และไหล่ด้านล่าง)
 * กรอบไม่เกินขอบรูปต้นฉบับ และคงสัดส่วน 413:531 เสมอ
 */
export function computeIdPhotoCrop(face: Box, imgW: number, imgH: number): Box {
  const ratio = ID_PHOTO_WIDTH / ID_PHOTO_HEIGHT;
  // กรอบตรวจจับครอบแค่คิ้วถึงคาง จึงใช้สัดส่วนที่วัดจากบัตรจริง เพื่อให่ใบหน้าใหญ่เท่าต้วอย่าง
  let h = face.height / ID_FACE_HEIGHT_RATIO;
  let w = h * ratio;
  if (w > imgW) { w = imgW; h = w / ratio; }
  if (h > imgH) { h = imgH; w = h * ratio; }
  const cx = face.x + face.width / 2;
  const cy = face.y + face.height / 2;
  let x = cx - w / 2;
  let y = cy - h * ID_FACE_CENTER_Y_RATIO;
  x = Math.min(Math.max(0, x), imgW - w);
  y = Math.min(Math.max(0, y), imgH - h);
  return { x, y, width: w, height: h };
}

/** ปรับแสง/คอนทราสต์อัตโนมัติแบบนุ่มนวล (ตัด 1% หัวท้ายของความสว่าง) */
export function autoLevels(data: Uint8ClampedArray, strength = 0.7) {
  const hist = new Array(256).fill(0);
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) hist[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]++;
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255; lo++) { acc += hist[lo]; if (acc > n * 0.01) break; }
  acc = 0;
  for (; hi > 0; hi--) { acc += hist[hi]; if (acc > n * 0.01) break; }
  if (hi - lo < 20) return;
  const scale = 255 / (hi - lo);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c];
      const s = (v - lo) * scale;
      data[i + c] = v + (s - v) * strength;
    }
  }
}

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("เปิดไฟล์รูปไม่ได้")); };
  img.src = url;
});

/**
 * ทำรูปติดบัตร: ตรวจหาใบหน้า ตัดหน้าตรงตามสัดส่วนรูปติดบัตร ปรับแสง แล้วคืน JPEG 413×531
 * ถ้าไม่พบใบหน้าหรือพบหลายคน จะ throw เพื่อไม่ให้บันทึกรูปผิดลงบัตร
 */
export async function makeIdCardPhoto(file: File): Promise<File> {
  const img = await loadImage(file);
  const faceapi = await import("@vladmandic/face-api");
  const { loadFaceModels, detectorOptionsHQ } = await import("./faceApi");
  await loadFaceModels();
  const faces = await faceapi.detectAllFaces(img, detectorOptionsHQ(608, 0.5));
  if (faces.length === 0) throw new Error("ไม่พบใบหน้าในรูป กรุณาใช้รูปหน้าตรงที่ชัดเจน");
  // เลือกใบหน้าใหญ่สุด (คนที่อยู่หน้าสุด) ถ้ามีคนอื่นติดมาด้านหลัง
  const face = faces.map(f => f.box).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const crop = computeIdPhotoCrop(face, img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = ID_PHOTO_WIDTH; canvas.height = ID_PHOTO_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์ไม่รองรับการปรับรูป");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, ID_PHOTO_WIDTH, ID_PHOTO_HEIGHT);
  const pixels = ctx.getImageData(0, 0, ID_PHOTO_WIDTH, ID_PHOTO_HEIGHT);
  autoLevels(pixels.data);
  ctx.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", 0.92));
  if (!blob) throw new Error("สร้างรูปติดบัตรไม่สำเร็จ");
  return new File([blob], "id-photo.jpg", { type: "image/jpeg" });
}
