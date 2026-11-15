// @vitest-environment node
import { describe, expect, it } from "vitest";
import { recordedFile, recordingMime } from "../recordedMedia";

describe("media recording compatibility", () => {
  it("uses Safari's supported audio format rather than labeling MP4 as WebM", () => {
    const mime = recordingMime("audio", type => type === "audio/mp4");
    expect(mime).toBe("audio/mp4");
    const file = recordedFile([new Blob(["captured audio"])], mime ?? "", "audio");
    expect(file.type).toBe("audio/mp4");
    expect(file.name.endsWith(".mp4")).toBe(true);
  });
  it("preserves the recorder's actual WebM video format", () => {
    const file = recordedFile([new Blob(["captured video"])], "video/webm;codecs=vp8,opus", "video");
    expect(file.type).toBe("video/webm;codecs=vp8,opus");
    expect(file.name.endsWith(".webm")).toBe(true);
    expect(file.size).toBe(14);
  });
  it("lets the browser choose its format if none of the candidates is supported", () => {
    expect(recordingMime("video", () => false)).toBeUndefined();
  });
  it("rejects an empty recording rather than attaching an unreadable file", () => {
    expect(() => recordedFile([], "audio/webm", "audio")).toThrow("ยังไม่มีข้อมูล");
  });
});