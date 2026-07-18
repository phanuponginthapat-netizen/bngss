import { ReactNode, useEffect, useLayoutEffect, useRef, useState, CSSProperties } from "react";

// ชุดเครื่องมือ "หน้ากระดาษ + ไม้บรรทัด" ใช้ร่วมกันทุก editor (Designer, RichEditor, WordLikeEditor)
// แก้ที่นี่ที่เดียว ทุกตัวเปลี่ยนตามทันที — ไม่ต้องไปนั่งทำซ้ำทีละไฟล์
export const PX_PER_MM = 3.7795275591;
const RULER = 18;

interface Props {
  /** width ของกระดาษ (mm) — A4 = 210 */
  paperWidthMm?: number;
  /** height ของกระดาษ 1 หน้า (mm) — A4 = 297 */
  paperHeightMm?: number;
  /** ระยะขอบ (mm) — ใช้เพื่อแรเงาบนไม้บรรทัด */
  margins?: { top: number; right: number; bottom: number; left: number };
  /** จำนวนหน้า (สำหรับเอกสารหลายหน้า) */
  pages?: number;
  /** แสดงไม้บรรทัด */
  showRulers?: boolean;
  /** ซูมแบบกำหนดเอง (0.5 = 50%) — ถ้าไม่ระบุจะ fit-to-width อัตโนมัติ */
  zoom?: number;
  /** style เพิ่มของกระดาษ (รวม padding) */
  pageStyle?: CSSProperties;
  /** className ของกล่องกระดาษ */
  pageClassName?: string;
  /** เนื้อหา editor */
  children: ReactNode;
  /** className ของ container ภายนอก */
  className?: string;
}

// ไม้บรรทัดแนวนอน — 1 ชิ้นต่อ 1 หน้า (เลขเริ่มที่ 0 ใหม่ทุกหน้า เหมือน Word)
const TopRuler = ({ widthPx, ml, mr, top = -RULER, pageNo }: { widthPx: number; ml: number; mr: number; top?: number; pageNo?: number }) => {
  const ticks = Math.floor(widthPx / PX_PER_MM / 10);
  return (
    <div style={{ position: "absolute", top, left: 0, width: widthPx, height: RULER, background: "#f1f5f9", borderBottom: "1px solid #94a3b8", borderTop: top !== -RULER ? "1px solid #94a3b8" : undefined, fontSize: 9, color: "#475569", overflow: "hidden", zIndex: 6 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: ml, height: "100%", background: "#cbd5e1" }} />
      <div style={{ position: "absolute", right: 0, top: 0, width: mr, height: "100%", background: "#cbd5e1" }} />
      {Array.from({ length: ticks + 1 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: i * 10 * PX_PER_MM, top: 0, bottom: 0, borderLeft: "1px solid #64748b", paddingLeft: 2, lineHeight: `${RULER}px` }}>{i}</div>
      ))}
      {pageNo && (
        <span style={{ position: "absolute", right: 6, top: 1, fontSize: 10, color: "#475569", background: "#e2e8f0", padding: "0 6px", borderRadius: 3, fontWeight: 600, lineHeight: `${RULER - 2}px` }}>หน้า {pageNo}</span>
      )}
    </div>
  );
};

// ไม้บรรทัดแนวตั้ง — เลขเริ่มที่ 0 ใหม่ทุกหน้า (เหมือน Word)
const LeftRuler = ({ heightPx, mt, pageHeightPx, pages }: { heightPx: number; mt: number; pageHeightPx: number; pages: number }) => {
  const perPageTicks = Math.floor(pageHeightPx / PX_PER_MM / 10);
  return (
    <div style={{ position: "absolute", top: 0, left: -RULER, width: RULER, height: heightPx, background: "#f1f5f9", borderRight: "1px solid #94a3b8", fontSize: 9, color: "#475569", overflow: "hidden" }}>
      {Array.from({ length: Math.max(1, pages) }).map((_, p) => {
        const pageTop = p * pageHeightPx;
        return (
          <div key={p} style={{ position: "absolute", top: pageTop, left: 0, right: 0, height: pageHeightPx }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: mt, background: "#cbd5e1" }} />
            {Array.from({ length: perPageTicks + 1 }).map((_, i) => (
              <div key={i} style={{ position: "absolute", top: i * 10 * PX_PER_MM, left: 0, right: 0, borderTop: "1px solid #64748b", paddingLeft: 2 }}>{i}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

const EFormPageCanvas = ({
  paperWidthMm = 210,
  paperHeightMm = 297,
  margins = { top: 25, right: 20, bottom: 20, left: 30 },
  pages = 1,
  showRulers = true,
  zoom,
  pageStyle,
  pageClassName,
  children,
  className,
}: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState(1);
  const [pageHeightPx, setPageHeightPx] = useState(paperHeightMm * PX_PER_MM * Math.max(1, pages));

  const PAGE_W = paperWidthMm * PX_PER_MM;
  const PAGE_H = paperHeightMm * PX_PER_MM;
  const ML_PX = margins.left * PX_PER_MM;
  const MR_PX = margins.right * PX_PER_MM;
  const MT_PX = margins.top * PX_PER_MM;
  const pageScale = zoom ?? autoScale;
  const totalH = Math.max(pageHeightPx, PAGE_H * Math.max(1, pages));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth - 16 - (showRulers ? RULER : 0);
      setAutoScale(Math.min(1, Math.max(0.3, w / PAGE_W)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [PAGE_W, showRulers]);

  // วัดความสูงจริงของหน้ากระดาษ → ทำให้ container เลื่อนได้สุด แม้เนื้อหายาวเกินขอบ
  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const measure = () => setPageHeightPx(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pages, paperHeightMm]);

  return (
    <div ref={wrapRef} className={className ?? "bg-slate-400/40 px-4 pt-8 pb-10 overflow-auto flex-1 flex justify-center"}>
      <div
        style={{
          width: `${(PAGE_W + (showRulers ? RULER : 0)) * pageScale}px`,
          height: `${totalH * pageScale + (showRulers ? RULER : 0) * pageScale}px`,
          position: "relative",
          flexShrink: 0,
          marginLeft: showRulers ? RULER * pageScale : 0,
          marginTop: showRulers ? RULER * pageScale : 0,
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, width: PAGE_W, height: totalH, transform: `scale(${pageScale})`, transformOrigin: "top left" }}>
          {showRulers && <TopRuler widthPx={PAGE_W} ml={ML_PX} mr={MR_PX} pageNo={1} />}
          {showRulers && <LeftRuler heightPx={totalH} mt={MT_PX} pageHeightPx={PAGE_H} pages={Math.max(1, pages)} />}
          <div
            ref={pageRef}
            className={pageClassName ?? "bg-white shadow-xl ring-1 ring-slate-300"}
            style={{
              ...pageStyle,
              width: `${paperWidthMm}mm`,
              maxWidth: `${paperWidthMm}mm`,
              minHeight: `${paperHeightMm * Math.max(1, pages)}mm`,
              position: "relative",
              // Prevent wide images / tables from forcing the paper to
              // scroll sideways under a finger drag.
              overflowX: "hidden",
            }}

          >
            {children}
            {Array.from({ length: Math.max(0, pages - 1) }).map((_, i) => {
              const pageBottom = (i + 1) * PAGE_H;
              const MB_PX = margins.bottom * PX_PER_MM;
              const MT_PX_NEXT = margins.top * PX_PER_MM;
              const bandTop = pageBottom - MB_PX;
              const bandHeight = MB_PX + MT_PX_NEXT;
              return (
                <div key={i} style={{ position: "absolute", left: -12, right: -12, top: bandTop, height: bandHeight, pointerEvents: "none", zIndex: 5 }}>
                  {/* แถบทึบสีพื้นนอกกระดาษ → มาสก์เนื้อหาที่ล้นเข้าเขตหัว/ท้ายกระดาษ ให้ดูเหมือนขึ้นหน้าใหม่จริง */}
                  <div style={{ position: "absolute", inset: 0, background: "#94a3b8" }} />
                  {/* เงาท้ายแผ่นบน */}
                  <div style={{ position: "absolute", left: 12, right: 12, top: 0, height: 1, background: "#475569", boxShadow: "0 6px 8px -4px rgba(0,0,0,0.35)" }} />
                  {/* เงาหัวแผ่นล่าง */}
                  <div style={{ position: "absolute", left: 12, right: 12, bottom: 0, height: 1, background: "#475569", boxShadow: "0 -6px 8px -4px rgba(0,0,0,0.35)" }} />
                  {showRulers && (
                    <span style={{ position: "absolute", left: "50%", top: bandHeight / 2 - 9, transform: "translateX(-50%)", fontSize: 11, color: "#fff", background: "#0f172a", padding: "2px 12px", borderRadius: 12, fontWeight: 700, lineHeight: "14px", whiteSpace: "nowrap" }}>
                      — หน้า {i + 2} —
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EFormPageCanvas;
