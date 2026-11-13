import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyMembershipsCard from "./MyMembershipsCard";

const state = vi.hoisted(() => ({
  roles: { hasAdminPower: false, hasDirectorPower: false, readOnly: false, loading: false },
  result: { data: [] as unknown[], error: null as null | Error },
  insert: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/hooks/useAuthSession", () => ({ useAuthSession: () => ({ session: { user: { id: "signed-in-owner" } } }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => state.roles }));
vi.mock("@/lib/swal", () => ({ swal: { success: state.success, error: state.error, confirm: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({
  select: () => ({ eq: async () => state.result }),
  insert: state.insert,
}) } }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value, disabled }: any) => <div><select aria-label="test-choice" disabled={disabled} value={value} onChange={e => onValueChange(e.target.value)}><option value="" />{children}</select></div>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}));
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MyMembershipsCard /></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  state.roles = { hasAdminPower: false, hasDirectorPower: false, readOnly: false, loading: false };
  state.result = { data: [], error: null };
  state.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "new-row" }, error: null }) }) });
});
describe("profile department authorization", () => {
  it("allows a real admin even when their display mode is teacher", async () => {
    state.roles.hasAdminPower = true;
    mount();
    await waitFor(() => expect(screen.getByRole("button", { name: "เพิ่มฝ่ายงาน" })).toBeInTheDocument());
  });
  it("allows a director", () => {
    state.roles.hasDirectorPower = true;
    mount();
    expect(screen.getByRole("button", { name: "เพิ่มฝ่ายงาน" })).toBeInTheDocument();
  });
  it("does not allow teachers to assign department permissions", () => {
    mount();
    expect(screen.queryByRole("button", { name: "เพิ่มฝ่ายงาน" })).not.toBeInTheDocument();
  });
  it("does not allow observers with director visibility to write", () => {
    state.roles.hasDirectorPower = true;
    state.roles.readOnly = true;
    mount();
    expect(screen.queryByRole("button", { name: "เพิ่มฝ่ายงาน" })).not.toBeInTheDocument();
  });
  it("blocks department writes when the source read fails", async () => {
    state.roles.hasAdminPower = true;
    state.result.error = new Error("read failed");
    mount();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "เพิ่มฝ่ายงาน" })).toBeDisabled();
    expect(state.insert).not.toHaveBeenCalled();
  });
  it("writes the signed-in owner and the selected department and level", async () => {
    state.roles.hasAdminPower = true;
    mount();
    await waitFor(() => expect(screen.getAllByRole("combobox")[0]).not.toBeDisabled());
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "academic" } });
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "deputy_head" } });
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มฝ่ายงาน" }));
    await waitFor(() => expect(state.insert).toHaveBeenCalledWith({ user_id: "signed-in-owner", department: "academic", dept_role: "deputy_head" }));
  });
  it("does not announce success for a denied insert", async () => {
    state.roles.hasAdminPower = true;
    state.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: null, error: new Error("denied") }) }) });
    mount();
    await waitFor(() => expect(screen.getAllByRole("combobox")[0]).not.toBeDisabled());
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "academic" } });
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มฝ่ายงาน" }));
    await waitFor(() => expect(state.error).toHaveBeenCalledWith("denied"));
    expect(state.success).not.toHaveBeenCalled();
  });
});