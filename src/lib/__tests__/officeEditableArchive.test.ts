// @vitest-environment node
import { it, expect } from "vitest";
import JSZip from "jszip";
import { attachEditableSource, readEditableSource } from "../office/editableArchive";
it("preserves original archive entries and exact editable slides through export/reopen", async () => {
  const zip = new JSZip(); zip.file("ppt/presentation.xml", "original");
  const data = [{ id: "s1", bg: "#ffffff", elements: [{ id: "e1", text: "สไลด์ทดสอบ" }] }];
  const blob = await attachEditableSource(await zip.generateAsync({ type: "blob" }), "slides", data);
  expect(await readEditableSource(await blob.arrayBuffer(), "slides")).toEqual(data);
  expect(await (await JSZip.loadAsync(await blob.arrayBuffer())).file("ppt/presentation.xml")?.async("string")).toBe("original");
});
it("does not invent editable content in external files", async () => {
  const zip = new JSZip(); zip.file("ppt/presentation.xml", "external");
  expect(await readEditableSource(await zip.generateAsync({ type: "arraybuffer" }), "slides")).toBeNull();
});