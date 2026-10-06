import { afterEach, describe, expect, it, vi } from "vitest";
import Swal from "sweetalert2";
import { toast } from "../sweetAlertToast";
import { swal } from "../swal";

afterEach(async () => {
  toast.dismiss();
  Swal.close();
  await new Promise(resolve => setTimeout(resolve, 150));
});

describe("Shared SweetAlert notices", () => {
  it("keeps confirmation open while background notices wait", async () => {
    const decision = swal.confirm({ title: "Confirm test" });
    toast.info("Queued notice", { duration: 10000 });
    expect(Swal.getTitle()?.textContent).toBe("Confirm test");
    Swal.clickCancel();
    expect(await decision).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(Swal.getTitle()?.textContent).toBe("Queued notice");
  });

  it("dismisses only its own loading notice", async () => {
    const loading = toast.loading("Loading");
    toast.dismiss(loading);
    await new Promise(resolve => setTimeout(resolve, 150));
    const decision = swal.confirm({ title: "Still open" });
    toast.dismiss(loading);
    expect(Swal.getTitle()?.textContent).toBe("Still open");
    Swal.clickConfirm();
    expect(await decision).toBe(true);
  });

  it("preserves actions and renders untrusted strings as text", async () => {
    const action = vi.fn();
    toast.error("<img src=x onerror=alert(1)>", { action: { label: "Retry", onClick: action } });
    expect(Swal.getTitle()?.querySelector("img")).toBeNull();
    Swal.clickConfirm();
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(action).toHaveBeenCalledOnce();
  });

  it("routes existing swal.toast calls into the same queue", async () => {
    const decision = swal.confirm({ title: "Do not replace" });
    swal.toast.warning("Warning");
    expect(Swal.getTitle()?.textContent).toBe("Do not replace");
    Swal.clickCancel();
    expect(await decision).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(Swal.getTitle()?.textContent).toBe("Warning");
  });
});