import { describe, expect, it } from "vitest";
import { getCorsHeaders } from "../../../supabase/functions/_shared/cors";

describe("school custom domain CORS", () => {
  it.each(["https://www.bngss.online", "https://bngss.online", "https://bngss.lovable.app"])("accepts %s", origin => {
    expect(getCorsHeaders(new Request("https://example.test", { headers: { origin } }))["Access-Control-Allow-Origin"]).toBe(origin);
  });
  it("does not accept a lookalike domain", () => {
    expect(getCorsHeaders(new Request("https://example.test", { headers: { origin: "https://www.bngss.online.evil.test" } }))["Access-Control-Allow-Origin"]).not.toBe("https://www.bngss.online.evil.test");
  });
});