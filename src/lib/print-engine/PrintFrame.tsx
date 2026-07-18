import { ReactNode, useEffect } from "react";
import "@fontsource/sarabun/400.css";
import "@fontsource/sarabun/700.css";
import { PAGE, FONT } from "./constants";

interface Props {
  children: ReactNode;
}

/**
 * กรอบกระดาษ A4 จริง — ใช้หน่วย mm ทั้งหมด
 * พิมพ์ผ่าน window.print() ได้เป๊ะตามตำแหน่ง
 */
export const PrintFrame = ({ children }: Props) => {
  useEffect(() => {
    const id = "print-engine-page-style";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      @page { size: ${PAGE.width}mm ${PAGE.height}mm; margin: 0; }
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
        body * { visibility: hidden; }
        .print-engine-root, .print-engine-root * { visibility: visible; }
        .print-engine-root { position: absolute; left: 0; top: 0; }
        .print-engine-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div className="print-engine-root">
      <div
        className="print-engine-page"
        style={{
          width: `${PAGE.width}mm`,
          height: `${PAGE.height}mm`,
          position: "relative",
          background: "#fff",
          color: "#000",
          fontFamily: FONT.family,
          fontSize: `${FONT.body}px`,
          lineHeight: 1.0,
          boxShadow: "0 0 8px rgba(0,0,0,0.15)",
          overflow: "hidden",
          margin: "0 auto",
        }}
      >
        {children}
      </div>
    </div>
  );
};
