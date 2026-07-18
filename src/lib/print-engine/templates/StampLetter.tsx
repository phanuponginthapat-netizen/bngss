import { OfficialDocSpec } from "../types";
import { PAGE, EMBLEM, FONT, SPACING } from "../constants";
import { GarudaEmblem } from "../GarudaEmblem";
import { CenteredEmblem } from "../SignerBlock";

const mm = (n: number) => `${n}mm`;
const pt = (n: number) => `${n}px`; // was pt — FONT constants already in px

/**
 * แบบ ๓ หนังสือประทับตรา
 */
export const StampLetter = ({ spec }: { spec: OfficialDocSpec }) => {
  const L = PAGE.marginLeft;
  const R = PAGE.marginRight;
  const yEmblem = EMBLEM.topOffset;
  const yRef = yEmblem + EMBLEM.externalSize + 6;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <CenteredEmblem topMm={yEmblem}>
        <GarudaEmblem sizeMm={EMBLEM.externalSize} />
      </CenteredEmblem>

      <div style={{ position: "absolute", left: mm(L), top: mm(yRef), fontSize: pt(FONT.body) }}>
        ที่ {spec.refNo}
      </div>
      <div style={{ position: "absolute", right: mm(R), top: mm(yRef), textAlign: "right", fontSize: pt(FONT.body), whiteSpace: "pre-line", lineHeight: 1.2 }}>
        {spec.school.name}
        {"\n"}
        {spec.school.address}
      </div>

      <div style={{ position: "absolute", left: mm(L), right: mm(R), top: mm(yRef + 22), fontSize: pt(FONT.body), lineHeight: 1.4 }}>
        <div style={{ marginBottom: mm(4) }}>ถึง {spec.to ?? ""}</div>

        {spec.body.split("\n\n").map((p, i) => (
          <p key={i} style={{ margin: 0, marginBottom: mm(2), textIndent: mm(SPACING.paragraphIndent), textAlign: "justify" }}>
            {p}
          </p>
        ))}

        <div style={{ marginTop: mm(10), textAlign: "center" }}>
          <div style={{ marginBottom: mm(2) }}>{spec.school.name}</div>
          <div style={{ border: "1px dashed #555", width: mm(28), height: mm(28), borderRadius: "50%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: pt(10), color: "#666" }}>
            ตราประทับ
          </div>
          <div style={{ marginTop: mm(3) }}>{spec.date}</div>
        </div>
      </div>

      {(spec.school.phone || spec.school.email) && (
        <div style={{ position: "absolute", left: mm(L), right: mm(R), bottom: mm(PAGE.marginBottom), fontSize: pt(FONT.body - 2), lineHeight: 1.2 }}>
          {spec.school.phone && <div>โทร. {spec.school.phone}</div>}
          {spec.school.email && <div>ไปรษณีย์อิเล็กทรอนิกส์ {spec.school.email}</div>}
        </div>
      )}
    </div>
  );
};
