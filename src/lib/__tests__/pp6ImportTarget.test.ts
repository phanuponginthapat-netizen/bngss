// @vitest-environment node
import { expect, it } from "vitest";
import { requirePp6ImportTerm } from "../pp6ImportTarget";
it("keeps the uploaded file's semester 1 and academic year 2569", () => {
  expect(requirePp6ImportTerm({ semester: 1, academicYear: 2569 })).toEqual({ semester: 1, year: 2569 });
});
it("rejects missing semester instead of defaulting to 1", () => {
  expect(() => requirePp6ImportTerm({ academicYear: 2569 })).toThrow();
});
it("rejects missing year instead of using the current year", () => {
  expect(() => requirePp6ImportTerm({ semester: 1 })).toThrow();
});