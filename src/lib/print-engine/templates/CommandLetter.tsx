import { OfficialDocSpec } from "../types";
import { PAGE, EMBLEM, FONT, SPACING } from "../constants";
import { GarudaEmblem } from "../GarudaEmblem";
import { SignerBlock, CenteredEmblem } from "../SignerBlock";

const mm = (n: number) => `${n}mm`;
const pt = (n: number) => `${n}px`; // was pt — FONT constants already in px

/**
 * แบบ ๔ คำสั่ง — ครุฑเต็มตัว 3 cm กึ่งกลาง
 */
export const CommandLetter = ({ spec }: { spec: OfficialDocSpec }) => {
  const L = PAGE.marginLeft;
  const R = PAGE.marginRight;
  const yTitle = EMBLEM.topOffset + EMBLEM.commandSize + 6;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <CenteredEmblem topMm={EMBLEM.topOffset}>
        <GarudaEmblem sizeMm={EMBLEM.commandSize} />
      </CenteredEmblem>

      <div style={{ position: "absolute", left: 0, right: 0, top: mm(yTitle), textAlign: "center", fontSize: pt(20), fontWeight: "bold", lineHeight: 1.45 }}>
        <div>คำสั่ง{spec.school.name}</div>
        <div>ที่ {spec.orderNo ?? spec.refNo}</div>
        <div>เรื่อง {spec.orderTitle ?? spec.subject}</div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: mm(yTitle + 32), textAlign: "center", fontSize: pt(FONT.body) }}>
        ─────────────────
      </div>

      <div style={{ position: "absolute", left: mm(L), right: mm(R), top: mm(yTitle + 40), fontSize: pt(FONT.body), lineHeight: 1.45 }}>
        {spec.body.split("\n\n").map((p, i) => (
          <p key={i} style={{ margin: 0, marginBottom: mm(2), textIndent: mm(SPACING.paragraphIndent), textAlign: "justify" }}>
            {p}
          </p>
        ))}

        {spec.effectiveFrom && (
          <p style={{ margin: 0, marginTop: mm(4), textIndent: mm(SPACING.paragraphIndent) }}>
            ทั้งนี้ ตั้งแต่{spec.effectiveFrom}
          </p>
        )}

        <div style={{ marginTop: mm(6), textAlign: "center" }}>สั่ง ณ วันที่ {spec.date}</div>

        <SignerBlock signer={spec.signer} marginTopMm={10} />
      </div>
    </div>
  );
};
