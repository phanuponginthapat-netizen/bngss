import { describe, it, expect } from "vitest";
import { EFORM_PAGE_MM, EFORM_PAGE_STYLE, wrapEFormPrintHtml } from "@/lib/eformLayout";
import { escapePrintTitle } from "@/lib/printUtils";

describe("official document layout (ระเบียบงานสารบรรณ)", () => {
  it("uses A4 with margins top 2.5cm, right 2cm, bottom 2cm, left 3cm", () => {
    expect(EFORM_PAGE_MM).toMatchObject({ width: 210, height: 297, marginTop: 25, marginRight: 20, marginBottom: 20, marginLeft: 30 });
  });
  it("uses TH Sarabun 16pt body text", () => {
    expect(EFORM_PAGE_STYLE.fontSize).toBe("16pt");
    expect(wrapEFormPrintHtml("<p>x</p>")).toContain("font-size:16pt");
  });
  it("escapes document titles in the print window", () => {
    expect(escapePrintTitle("<b>ปพ.1</b>")).toBe("&lt;b&gt;ปพ.1&lt;/b&gt;");
  });
});
