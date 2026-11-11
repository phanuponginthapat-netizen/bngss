// @vitest-environment node
import { describe, expect, it } from "vitest";
import { measuredAverage, percentageChange, weightedChartAverage } from "../chartMetrics";
describe("truthful chart measurements", () => {
  it("keeps a recorded zero and excludes missing scores",()=>expect(measuredAverage([0,100,null,undefined,""])).toBe(50));
  it("has no average without measurements",()=>expect(measuredAverage([null,undefined])).toBeNull());
  it("cannot claim 100 percent growth from a zero baseline",()=>expect(percentageChange(10,0)).toBeNull());
  it("computes a measured 25 percent increase",()=>expect(percentageChange(125,100)).toBe(25));
  it("weights the overall score by actual score records",()=>expect(weightedChartAverage([{value:0,count:1},{value:100,count:3},{value:null,count:0}])).toBe(75));
});