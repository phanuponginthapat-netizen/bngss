import { OfficialDocSpec } from "../types";
import { PAGE, EMBLEM, FONT, SPACING } from "../constants";
import { GarudaEmblem } from "../GarudaEmblem";
import { SignerBlock, CenteredEmblem } from "../SignerBlock";

const mm = (n: number) => `${n}mm`;
const pt = (n: number) => `${n}px`; // was pt — FONT constants already in px

/**
 * แบบ ๕/๖ ระเบียบ / ข้อบังคับ
 */
export const Regulation = ({ spec, heading }: { spec: OfficialDocSpec; heading: "ระเบียบ" | "ข้อบังคับ" }) => {
  const L = PAGE.marginLeft;
  const R = PAGE.marginRight;
  const yTitle = EMBLEM.topOffset + EMBLEM.commandSize + 6;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <CenteredEmblem topMm={EMBLEM.topOffset}>
        <GarudaEmblem sizeMm={EMBLEM.commandSize} />
      </CenteredEmblem>

      <div style={{ position: "absolute", left: 0, right: 0, top: mm(yTitle), textAlign: "center", fontSize: pt(20), fontWeight: "bold", lineHeight: 1.45 }}>
        <div>{heading}{spec.school.name}</div>
        {spec.about && <div>ว่าด้วย {spec.about}</div>}
        {spec.edition && <div style={{ fontSize: pt(FONT.body), fontWeight: "normal" }}>(ฉบับที่ {spec.edition})</div>}
        <div>พ.ศ. {spec.buddhistYear ?? ""}</div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: mm(yTitle + 40), textAlign: "center", fontSize: pt(FONT.body) }}>
        ─────────────────
      </div>

      <div style={{ position: "absolute", left: mm(L), right: mm(R), top: mm(yTitle + 48), fontSize: pt(FONT.body), lineHeight: 1.45 }}>
        {spec.body.split("\n\n").map((p, i) => (
          <p key={i} style={{ margin: 0, marginBottom: mm(2), textIndent: mm(SPACING.paragraphIndent), textAlign: "justify" }}>
            {p}
          </p>
        ))}

        <div style={{ marginTop: mm(8), textAlign: "center" }}>ประกาศ ณ วันที่ {spec.date}</div>

        <SignerBlock signer={spec.signer} marginTopMm={10} />
      </div>
    </div>
  );
};
