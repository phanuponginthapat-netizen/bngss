import { OfficialDocSpec } from "../types";
import { PAGE, EMBLEM, FONT, SPACING } from "../constants";
import { GarudaEmblem } from "../GarudaEmblem";
import { SignerBlock, CenteredEmblem } from "../SignerBlock";

const mm = (n: number) => `${n}mm`;
const pt = (n: number) => `${n}px`; // was pt — FONT constants already in px

/**
 * แบบ ๑๐ หนังสือรับรอง
 */
export const Certificate = ({ spec }: { spec: OfficialDocSpec }) => {
  const L = PAGE.marginLeft;
  const R = PAGE.marginRight;
  const yEmblem = EMBLEM.topOffset;
  const yMeta = yEmblem + EMBLEM.externalSize + 6;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <CenteredEmblem topMm={yEmblem}>
        <GarudaEmblem sizeMm={EMBLEM.externalSize} />
      </CenteredEmblem>

      <div style={{ position: "absolute", left: mm(L), top: mm(yMeta), fontSize: pt(FONT.body) }}>
        เลขที่ {spec.refNo}
      </div>
      <div style={{ position: "absolute", right: mm(R), top: mm(yMeta), textAlign: "right", fontSize: pt(FONT.body), whiteSpace: "pre-line", lineHeight: 1.2 }}>
        {spec.school.name}
        {"\n"}
        {spec.school.address}
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: mm(yMeta + 18), textAlign: "center", fontSize: pt(22), fontWeight: "bold" }}>
        หนังสือรับรอง
      </div>

      <div style={{ position: "absolute", left: mm(L), right: mm(R), top: mm(yMeta + 32), fontSize: pt(FONT.body), lineHeight: 1.5 }}>
        <p style={{ margin: 0, marginBottom: mm(2), textIndent: mm(SPACING.paragraphIndent), textAlign: "justify" }}>
          หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า
        </p>
        {spec.body.split("\n\n").map((p, i) => (
          <p key={i} style={{ margin: 0, marginBottom: mm(2), textIndent: mm(SPACING.paragraphIndent), textAlign: "justify" }}>
            {p}
          </p>
        ))}

        <div style={{ marginTop: mm(8), textAlign: "center" }}>ให้ไว้ ณ วันที่ {spec.date}</div>

        <SignerBlock signer={spec.signer} marginTopMm={10} />
      </div>
    </div>
  );
};
