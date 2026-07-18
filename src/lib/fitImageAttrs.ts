/**
 * วัดขนาดจริงของรูปจาก src (data URL หรือ URL) แล้วคืน attrs
 * ที่ย่อความกว้างให้พอดีกับ maxPx โดยคงสัดส่วนเดิมไว้
 * ใช้ร่วมกันระหว่าง e-form / CMS / print-template rich editor
 */
export const fitImageAttrs = (
  src: string,
  maxPx: number,
  /** สัดส่วนย่อรูปเทียบกับความกว้าง content (ค่า default 0.7 = 70% เพื่อให้อยู่ในขอบกระดาษสวยงาม) */
  scale: number = 0.7,
): Promise<{ src: string; width?: string; height?: string }> => {
  return new Promise((resolve) => {
    if (!src) return resolve({ src });
    const targetPx = Math.max(80, Math.round(maxPx * scale));
    const probe = new Image();
    const done = (attrs: { src: string; width?: string; height?: string }) => resolve(attrs);
    probe.onload = () => {
      const nw = probe.naturalWidth || 0;
      const nh = probe.naturalHeight || 0;
      // ย่อรูปเสมอถ้าใหญ่กว่า target (จะเล็กลงเท่า 70% ของพื้นที่กระดาษ)
      const finalW = nw > 0 ? Math.min(nw, targetPx) : targetPx;
      const finalH = nw > 0 && nh > 0 ? Math.round((nh / nw) * finalW) : 0;
      done({ src, width: `${finalW}px`, ...(finalH ? { height: `${finalH}px` } : {}) });
    };
    probe.onerror = () => done({ src });
    probe.src = src;
  });
};

/** ความกว้าง content เป็น px ที่ 96dpi จากขนาดกระดาษ (มม.) และระยะขอบ (มม.) */
export const paperContentMaxPx = (
  paperWidthMm: number,
  marginLeftMm: number,
  marginRightMm: number,
) => {
  const contentMm = Math.max(50, paperWidthMm - marginLeftMm - marginRightMm);
  return Math.round((contentMm / 25.4) * 96);
};
