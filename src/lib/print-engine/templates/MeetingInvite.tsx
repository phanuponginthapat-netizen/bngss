import { OfficialDocSpec } from "../types";
import { ExternalLetter } from "./ExternalLetter";

/**
 * หนังสือเชิญประชุม — ใช้ layout หนังสือภายนอก (subject: "ขอเชิญประชุม...")
 */
export const MeetingInvite = ({ spec }: { spec: OfficialDocSpec }) => (
  <ExternalLetter spec={spec} />
);
