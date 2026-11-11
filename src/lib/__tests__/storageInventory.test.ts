// @vitest-environment node
import { describe, expect, it } from "vitest";
import { inventoryRows, storageFootprint } from "../../../supabase/functions/_shared/storageInventory";

describe("complete storage totals", () => {
  it("rejects a failed later registry page rather than publishing partial totals", async () => {
    await expect(inventoryRows(async from => from === 0 ? { data: [1, 2], error: null } : { data: null, error: { message: "registry failed" } }, 2)).rejects.toThrow("registry failed");
  });
  it("rejects a failed folder read rather than reporting zero files", async () => {
    await expect(storageFootprint(async () => ({ data: null, error: { message: "folder failed" } }))).rejects.toThrow("folder failed");
  });
  it("includes files deeper than five folders", async () => {
    const result = await storageFootprint(async prefix => ({ data: prefix.split("/").filter(Boolean).length < 7 ? [{ name: "folder" }] : [{ id: "file", name: "photo", metadata: { size: 123 } }], error: null }));
    expect(result).toEqual({ files: 1, bytes: 123 });
  });
  it("does not invent a zero size when metadata is unavailable", async () => {
    await expect(storageFootprint(async () => ({ data: [{ id: "file", name: "photo" }], error: null }))).rejects.toThrow("size unavailable");
  });
});