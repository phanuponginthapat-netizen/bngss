// @vitest-environment node
import { describe, expect, it } from "vitest";
import { homeworkRealtimeKeys } from "../homeworkRealtime";

describe("live homework updates", () => {
  it("refreshes submitted task homework without a page reload", () => {
    expect(homeworkRealtimeKeys("task_assignments")).toContainEqual(["homework-list"]);
  });
  it("refreshes the rich homework list", () => {
    expect(homeworkRealtimeKeys("homework_assignments")).toContainEqual(["hw-assignments"]);
  });
  it("refreshes open grading reads for new submissions", () => {
    expect(homeworkRealtimeKeys("homework_submissions")).toContainEqual(["hw-submissions"]);
  });
  it("does not refresh homework for unrelated tables", () => {
    expect(homeworkRealtimeKeys("students")).toEqual([]);
  });
});