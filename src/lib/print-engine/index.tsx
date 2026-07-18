import { OfficialDocSpec } from "./types";
import { PrintFrame } from "./PrintFrame";
import { ExternalLetter } from "./templates/ExternalLetter";
import { InternalLetter } from "./templates/InternalLetter";
import { StampLetter } from "./templates/StampLetter";
import { CommandLetter } from "./templates/CommandLetter";
import { Regulation } from "./templates/Regulation";
import { Announcement } from "./templates/Announcement";
import { Statement } from "./templates/Statement";
import { News } from "./templates/News";
import { MeetingInvite } from "./templates/MeetingInvite";
import { Certificate } from "./templates/Certificate";

export * from "./types";
export * from "./constants";
export { PrintFrame };

interface Props {
  spec: OfficialDocSpec;
}

export const OfficialDocument = ({ spec }: Props) => {
  return (
    <PrintFrame>
      {spec.kind === "external" && <ExternalLetter spec={spec} />}
      {spec.kind === "internal" && <InternalLetter spec={spec} />}
      {spec.kind === "stamp" && <StampLetter spec={spec} />}
      {spec.kind === "command" && <CommandLetter spec={spec} />}
      {spec.kind === "regulation" && <Regulation spec={spec} heading="ระเบียบ" />}
      {spec.kind === "bylaw" && <Regulation spec={spec} heading="ข้อบังคับ" />}
      {spec.kind === "announcement" && <Announcement spec={spec} />}
      {spec.kind === "statement" && <Statement spec={spec} />}
      {spec.kind === "news" && <News spec={spec} />}
      {spec.kind === "meeting" && <MeetingInvite spec={spec} />}
      {spec.kind === "certificate" && <Certificate spec={spec} />}
    </PrintFrame>
  );
};

export const DOC_KIND_LABELS: Record<OfficialDocSpec["kind"], string> = {
  external: "แบบ ๑ หนังสือภายนอก",
  internal: "แบบ ๒ บันทึกข้อความ",
  stamp: "แบบ ๓ หนังสือประทับตรา",
  command: "แบบ ๔ คำสั่ง",
  regulation: "แบบ ๕ ระเบียบ",
  bylaw: "แบบ ๖ ข้อบังคับ",
  announcement: "แบบ ๗ ประกาศ",
  statement: "แบบ ๘ แถลงการณ์",
  news: "แบบ ๙ ข่าว",
  certificate: "แบบ ๑๐ หนังสือรับรอง",
  meeting: "หนังสือเชิญประชุม",
};
