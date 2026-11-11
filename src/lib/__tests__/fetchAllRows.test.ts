// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fetchAllRows, countRows } from "../fetchAllRows";
describe("complete statistical source reads", () => {
  it("rejects a failed later page instead of returning partial totals", async () => {
    await expect(fetchAllRows(async start => start === 0 ? {data:[1,2],error:null} : {data:null,error:new Error("source failed")},{pageSize:2})).rejects.toThrow("source failed");
  });
  it("rejects exhausted read limits instead of publishing a truncated total", async () => {
    await expect(fetchAllRows(async()=>({data:[1,2],error:null}),{pageSize:2,maxRows:2})).rejects.toThrow();
  });
  it("does not translate a failed count into zero", async () => {
    await expect(countRows(async()=>({count:null,error:new Error("count failed")}))).rejects.toThrow("count failed");
  });
  it("returns an actual zero count", async () => expect(await countRows(async()=>({count:0,error:null}))).toBe(0));
});