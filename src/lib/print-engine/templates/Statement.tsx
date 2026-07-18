import { OfficialDocSpec } from "../types";
import { PAGE, EMBLEM, FONT, SPACING } from "../constants";
import { GarudaEmblem } from "../GarudaEmblem";
import { CenteredEmblem } from "../SignerBlock";

const mm = (n: number) => `${n}mm`;
const pt = (n: number) => `${n}px`; // was pt — FONT constants already in px

/**
 * แบบ ๘ แถลงการณ์
 */
export const Statement = ({ spec }: { spec: OfficialDocSpec }) => {
  const L = PAGE.marginLeft;
  const R = PAGE.marginRight;
  const yTitle = EMBLEM.topOffset + EMBLEM.commandSize + 6;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <CenteredEmblem topMm={EMBLEM.topOffset}>
        <GarudaEmblem sizeMm={EMBLEM.commandSize} />
      </CenteredEmblem>

      <div style={{ position: "absolute", left: 0, right: 0, top: mm(yTitle), textAlign: "center", fontSize: pt(20), fontWeight: "bold", lineHeight: 1.45 }}>
        <div>แถลงการณ์{spec.school.name}</div>
        <div>เรื่อง {spec.subject}</div>
        {spec.issueNo && <div style={{ fontSize: pt(FONT.body), fontWeight: "normal" }}>ฉบับที่ {spec.issueNo}</div>}
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

        <div style={{ marginTop: mm(12), textAlign: "center" }}>
          <div>{spec.school.name}</div>
          <div style={{ marginTop: mm(2) }}>{spec.date}</div>
        </div>
      </div>
    </div>
  );
};
