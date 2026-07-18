import { OfficialDocSpec } from "../types";
import { PAGE, EMBLEM, FONT, SPACING } from "../constants";
import { GarudaEmblem } from "../GarudaEmblem";
import { SignerBlock, CenteredEmblem } from "../SignerBlock";

const mm = (n: number) => `${n}mm`;
const pt = (n: number) => `${n}px`; // was pt — FONT constants already in px

/**
 * แบบ ๗ ประกาศ
 *   ครุฑเต็มตัว 3 cm กึ่งกลาง → "ประกาศ<ชื่อหน่วยงาน>" → "เรื่อง ..." → เส้นคั่น
 *   → body → "ประกาศ ณ วันที่ ..." → signer ครึ่งขวา
 */
export const Announcement = ({ spec }: { spec: OfficialDocSpec }) => {
  const L = PAGE.marginLeft;
  const R = PAGE.marginRight;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <CenteredEmblem topMm={EMBLEM.topOffset}>
        <GarudaEmblem sizeMm={EMBLEM.commandSize} />
      </CenteredEmblem>

      <div style={{ position: "absolute", left: 0, right: 0, top: mm(EMBLEM.topOffset + EMBLEM.commandSize + 6), textAlign: "center", fontSize: pt(20), fontWeight: "bold", lineHeight: 1.45 }}>
        <div>ประกาศ{spec.school.name}</div>
        <div>เรื่อง {spec.subject}</div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: mm(EMBLEM.topOffset + EMBLEM.commandSize + 24), textAlign: "center", fontSize: pt(FONT.body) }}>
        ─────────────────
      </div>

      <div style={{ position: "absolute", left: mm(L), right: mm(R), top: mm(EMBLEM.topOffset + EMBLEM.commandSize + 32), fontSize: pt(FONT.body), lineHeight: 1.45 }}>
        {spec.body.split("\n\n").map((p, i) => (
          <p key={i} style={{ margin: 0, marginBottom: mm(2), textIndent: mm(SPACING.paragraphIndent), textAlign: "justify" }}>
            {p}
          </p>
        ))}

        <div style={{ marginTop: mm(6), textAlign: "center" }}>ประกาศ ณ วันที่ {spec.date}</div>

        <SignerBlock signer={spec.signer} marginTopMm={10} />
      </div>
    </div>
  );
};
