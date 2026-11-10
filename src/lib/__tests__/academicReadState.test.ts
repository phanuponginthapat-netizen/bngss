import { describe, expect, it } from "vitest";
import { academicReadState } from "../academicReadState";

describe("academic reads fail closed", () => {
  it("does not consider a failed source an empty successful result", () => {
    const error = { code: "TEST_OUTAGE" };
    expect(academicReadState([{ error }])).toEqual({ error, loading: false, ready: false });
  });
  it("blocks documents and schedule actions while any dependent source is loading", () => {
    expect(academicReadState([{}, { isLoading: true }]).ready).toBe(false);
  });
  it("blocks stale documents while refreshing a source", () => {
    expect(academicReadState([{ isFetching: true }]).ready).toBe(false);
  });
  it("does not use a fallback academic calendar after a calendar read failure", () => {
    expect(academicReadState([{}], false, new Error("calendar unavailable")).ready).toBe(false);
  });
  it("recovers after all sources successfully load, including truly empty sources", () => {
    expect(academicReadState([{}, {}])).toEqual({ error: undefined, loading: false, ready: true });
  });
});