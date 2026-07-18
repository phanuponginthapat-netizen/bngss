import { OfficialDocSpec } from "../types";
import { PAGE, EMBLEM, FONT, SPACING } from "../constants";
import { GarudaEmblem } from "../GarudaEmblem";
import { SignerBlock, CenteredEmblem } from "../SignerBlock";

interface Props {
  spec: OfficialDocSpec;
}

const mm = (n: number) => `${n}mm`;
const pt = (n: number) => `${n}px`; // was pt — FONT constants already in px

/**
 * หนังสือภายนอก — Layout ตามคู่มือสำนักนายกฯ
 * - ครุฑครึ่งตัว 1.5 cm กึ่งกลางบน ห่างขอบบน 1.5 cm
 * - "ที่" ห่างจากครุฑ 2 บรรทัด ชิดซ้าย
 * - ที่อยู่โรงเรียน ชิดขวา บรรทัดเดียวกับ "ที่"
 * - "วัน เดือน พ.ศ." กึ่งกลาง ห่าง 2 บรรทัด
 */
export const ExternalLetter = ({ spec }: Props) => {
  const innerLeft = PAGE.marginLeft;
  const innerRight = PAGE.width - PAGE.marginRight;
  const innerWidth = innerRight - innerLeft;
  const centerX = PAGE.width / 2;

  // Y positions (mm) ตามคู่มือ
  const yEmblem = EMBLEM.topOffset;                     // 15mm
  const yRefLine = yEmblem + EMBLEM.externalSize + 6;   // 1 บรรทัดหลังครุฑ
  const yDate = yRefLine + 8;                           // วันที่
  const ySubject = yDate + 10;                          // เรื่อง
  const yTo = ySubject + 7;                             // เรียน
  const yAttach = yTo + 7;                              // สิ่งที่ส่งมาด้วย
  const yBody = yAttach + (spec.attachments?.length ? 8 : 0) + 8;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* ครุฑ — กึ่งกลางหน้า */}
      <CenteredEmblem topMm={yEmblem}>
        <GarudaEmblem sizeMm={EMBLEM.externalSize} />
      </CenteredEmblem>


      {/* แถวที่/ที่อยู่โรงเรียน */}
      <div
        style={{
          position: "absolute",
          left: mm(innerLeft),
          top: mm(yRefLine),
          fontSize: pt(FONT.body),
        }}
      >
        ที่ {spec.refNo}
      </div>
      <div
        style={{
          position: "absolute",
          right: mm(PAGE.marginRight),
          top: mm(yRefLine),
          textAlign: "right",
          fontSize: pt(FONT.body),
          lineHeight: 1.1,
          whiteSpace: "pre-line",
        }}
      >
        {spec.school.name}
        {"\n"}
        {spec.school.address}
      </div>

      {/* วันที่ — กึ่งกลาง */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: mm(yDate + (spec.school.address.split("\n").length - 1) * 6),
          textAlign: "center",
          fontSize: pt(FONT.body),
        }}
      >
        {spec.date}
      </div>

      {/* เรื่อง / เรียน / สิ่งที่ส่งมาด้วย / อ้างถึง */}
      <div
        style={{
          position: "absolute",
          left: mm(innerLeft),
          right: mm(PAGE.marginRight),
          top: mm(ySubject + (spec.school.address.split("\n").length - 1) * 6),
          fontSize: pt(FONT.body),
          lineHeight: 1.4,
        }}
      >
        <Row label="เรื่อง" value={spec.subject} />
        {spec.to && <Row label="เรียน" value={spec.to} />}
        {spec.refs?.map((r, i) => (
          <Row key={i} label={i === 0 ? "อ้างถึง" : ""} value={r} />
        ))}
        {spec.attachments?.map((a, i) => (
          <Row key={i} label={i === 0 ? "สิ่งที่ส่งมาด้วย" : ""} value={a} />
        ))}

        {/* เนื้อความ */}
        <div style={{ marginTop: mm(SPACING.blankLine), textAlign: "justify" }}>
          {spec.body.split("\n\n").map((p, i) => (
            <p
              key={i}
              style={{
                margin: 0,
                marginBottom: mm(2),
                textIndent: mm(SPACING.paragraphIndent),
                lineHeight: 1.35,
              }}
            >
              {p}
            </p>
          ))}
        </div>

        {/* คำลงท้าย — ครึ่งขวา */}
        {spec.salutation && (
          <div style={{ marginTop: mm(6), marginLeft: "50%", paddingLeft: mm(16) }}>
            {spec.salutation}
          </div>
        )}

        {/* ลงนาม — ครึ่งขวาของหน้า */}
        <SignerBlock signer={spec.signer} marginTopMm={4} />

      </div>

      {/* footer */}
      {spec.school.phone || spec.school.email ? (
        <div
          style={{
            position: "absolute",
            left: mm(innerLeft),
            right: mm(PAGE.marginRight),
            bottom: mm(PAGE.marginBottom),
            fontSize: pt(FONT.body - 2),
            lineHeight: 1.2,
          }}
        >
          {spec.school.phone && <div>โทร. {spec.school.phone}</div>}
          {spec.school.fax && <div>โทรสาร {spec.school.fax}</div>}
          {spec.school.email && <div>ไปรษณีย์อิเล็กทรอนิกส์ {spec.school.email}</div>}
        </div>
      ) : null}
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: "flex", marginBottom: "2mm" }}>
    <div style={{ width: "30mm", flexShrink: 0 }}>{label}</div>
    <div style={{ flex: 1 }}>{value}</div>
  </div>
);
