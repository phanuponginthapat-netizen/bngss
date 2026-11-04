import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// students has two links to classrooms; an unnamed embed fails (PGRST201) and silently returns no rows.
const files = [
  "src/pages/ParentAppPage.tsx",
  "supabase/functions/line-webhook/index.ts",
  "supabase/functions/face-scan-summary/index.ts",
  "supabase/functions/face-scan-daily-report/index.ts",
  "supabase/functions/attendance-daily-report/index.ts",
  "src/pages/student/OffsiteTripsPage.tsx",
  "src/pages/certificates/CertificatePrintPage.tsx",
];

describe("students → classrooms embeds", () => {
  for (const f of files) {
    it(`${f} names the classroom link`, () => {
      const src = readFileSync(f, "utf8");
      const blocks = src.split(/\.from\(/).filter((b) => b.startsWith('"students"'));
      for (const b of blocks) {
        const sel = b.slice(0, 400);
        expect(sel).not.toMatch(/[\s,"(]classrooms\(/);
      }
    });
  }
});
