import { OfficialDocSpec } from "./types";

const mm = (n: number) => `${n}mm`;

/**
 * บล็อกลงนาม ตามคู่มือสำนักนายกฯ
 *   (ลงชื่อ) ....ลายเซ็น....
 *           (พิมพ์ชื่อเต็ม)
 *           (ตำแหน่ง)
 *
 *  - วางในครึ่งขวาของหน้า (marginLeft 50%)
 *  - ป้าย "(ลงชื่อ)" อยู่ซ้ายของเส้นลายเซ็น
 *  - ชื่อเต็มและตำแหน่ง จัดกึ่งกลางใต้เส้นลายเซ็น (ไม่ใช่กึ่งกลางทั้งบล็อก)
 */
export const SignerBlock = ({
  signer,
  marginTopMm = 10,
}: {
  signer: OfficialDocSpec["signer"];
  marginTopMm?: number;
}) => {
  const SIG_WIDTH = 60; // mm ของเส้นลายเซ็น
  const LABEL_WIDTH = 16; // mm สำหรับ "(ลงชื่อ)"

  return (
    <div style={{ marginTop: mm(marginTopMm), marginLeft: "50%" }}>
      {/* แถวเส้นลายเซ็น */}
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <div style={{ width: mm(LABEL_WIDTH), flexShrink: 0 }}>(ลงชื่อ)</div>
        <div
          style={{
            width: mm(SIG_WIDTH),
            textAlign: "center",
            borderBottom: signer.signature ? "none" : "1px dotted #000",
            minHeight: mm(12),
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          {signer.signature && (
            <img
              src={signer.signature}
              alt="ลายเซ็น"
              style={{ height: mm(12), display: "block" }}
            />
          )}
        </div>
      </div>

      {/* ชื่อเต็ม — ตรงกลางใต้เส้นลายเซ็น */}
      <div style={{ display: "flex" }}>
        <div style={{ width: mm(LABEL_WIDTH), flexShrink: 0 }} />
        <div style={{ width: mm(SIG_WIDTH), textAlign: "center" }}>
          ({signer.name})
        </div>
      </div>

      {/* ตำแหน่ง */}
      <div style={{ display: "flex" }}>
        <div style={{ width: mm(LABEL_WIDTH), flexShrink: 0 }} />
        <div style={{ width: mm(SIG_WIDTH), textAlign: "center" }}>
          {signer.position}
        </div>
      </div>
    </div>
  );
};

/**
 * วางครุฑให้กึ่งกลางหน้าแบบ flex แทนการคำนวณ left
 */
export const CenteredEmblem = ({
  topMm,
  children,
}: {
  topMm: number;
  children: React.ReactNode;
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: mm(topMm),
      display: "flex",
      justifyContent: "center",
    }}
  >
    {children}
  </div>
);
