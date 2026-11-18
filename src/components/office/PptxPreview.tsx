import { useEffect, useRef, useState } from "react";
import { init } from "pptx-preview";

export function PptxPreview({ bytes }: { bytes: ArrayBuffer }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    let active = true;
    const preview = init(ref.current, { width: 960, height: 540, mode: "list" });
    preview.preview(bytes).catch(e => { if (active) setError(String(e?.message || e)); });
    return () => { active = false; preview.destroy(); };
  }, [bytes]);
  return <div className="overflow-auto p-4"><div ref={ref} />{error && <p role="alert" className="text-destructive">แสดงสไลด์ไม่สำเร็จ: {error}</p>}</div>;
}