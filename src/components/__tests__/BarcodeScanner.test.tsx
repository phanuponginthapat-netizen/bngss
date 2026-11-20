import React, { useEffect, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), clear: vi.fn(), ids: [] as string[] }));
vi.mock("html5-qrcode", () => ({
  Html5QrcodeSupportedFormats: { QR_CODE: 0, CODE_128: 1, CODE_39: 2, EAN_13: 3 },
  Html5Qrcode: class {
    isScanning = true;
    constructor(id: string) { mocks.ids.push(id); }
    start = mocks.start;
    stop = mocks.stop;
    clear = mocks.clear;
  },
}));
vi.mock("@/lib/cameraFocus", () => ({ applyCameraFocus: vi.fn() }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? children : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { const timer = setTimeout(() => setMounted(true), 90); return () => clearTimeout(timer); }, []);
    return mounted ? <div>{children}</div> : null;
  },
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
import BarcodeScanner from "../BarcodeScanner";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ids.length = 0;
  mocks.start.mockResolvedValue(null);
  mocks.stop.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn() } });
});
afterEach(cleanup);

describe("card scanner camera lifecycle", () => {
  it("waits for delayed dialog mount and acquires the camera only once", async () => {
    render(<BarcodeScanner open onClose={vi.fn()} onScan={vi.fn()} />);
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1));
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    const config = mocks.start.mock.calls[0][1];
    expect(config.qrbox(480, 270)).toEqual({ width: 202, height: 202 });
  });
  it("isolates simultaneous scanner regions and closes only the scanned instance", async () => {
    const firstScan = vi.fn();
    const secondScan = vi.fn();
    render(<><BarcodeScanner open onClose={vi.fn()} onScan={firstScan} /><BarcodeScanner open onClose={vi.fn()} onScan={secondScan} /></>);
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(2));
    expect(new Set(mocks.ids).size).toBe(2);
    mocks.start.mock.calls[1][2]("2539");
    expect(secondScan).toHaveBeenCalledWith("2539");
    expect(firstScan).not.toHaveBeenCalled();
  });
  it("retries after permission failure", async () => {
    mocks.start.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
    render(<BarcodeScanner open onClose={vi.fn()} onScan={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "ลองเปิดกล้องอีกครั้ง" }));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(2));
  });
  it("releases a camera whose permission request resolves after closing", async () => {
    let resolveStart: (() => void) | undefined;
    mocks.start.mockImplementationOnce(() => new Promise<void>(resolve => { resolveStart = resolve; }));
    const view = render(<BarcodeScanner open onClose={vi.fn()} onScan={vi.fn()} />);
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1));
    view.rerender(<BarcodeScanner open={false} onClose={vi.fn()} onScan={vi.fn()} />);
    resolveStart?.();
    await waitFor(() => expect(mocks.stop).toHaveBeenCalledTimes(1));
  });
});