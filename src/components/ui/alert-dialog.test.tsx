import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Swal from "sweetalert2";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from "./alert-dialog";

afterEach(() => { cleanup(); Swal.close(); });

describe("SweetAlert confirmation compatibility", () => {
  it("does not perform an action on cancel and preserves its trigger", async () => {
    const action = vi.fn();
    render(<AlertDialog><AlertDialogTrigger>Open test</AlertDialogTrigger><AlertDialogContent><AlertDialogTitle>Confirm action</AlertDialogTitle><AlertDialogCancel>Cancel test</AlertDialogCancel><AlertDialogAction onClick={action}>Apply test</AlertDialogAction></AlertDialogContent></AlertDialog>);
    fireEvent.click(screen.getByRole("button", { name: "Open test" }));
    await waitFor(() => expect(screen.getByText("Confirm action")).toBeTruthy());
    expect(Swal.getPopup()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel test" }));
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open test" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply test" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Apply test" }));
    expect(action).toHaveBeenCalledOnce();
  });
});