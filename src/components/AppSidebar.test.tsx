import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ role: "teacher" }) }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ lang: "th" }) }));
vi.mock("@/hooks/useSystemSettings", () => ({ useSystemSettings: () => ({ appName: "โรงเรียนทดสอบ", schoolName: "โรงเรียนทดสอบ", schoolLogo: null }) }));
vi.mock("@/hooks/useModuleToggles", () => ({ useModuleToggles: () => ({ isModuleEnabled: () => true }) }));
vi.mock("./SidebarAccountFooter", () => ({ SidebarAccountFooter: () => null }));
vi.mock("./ViewModeSwitcher", () => ({ ViewModeSwitcher: () => null }));

afterEach(cleanup);

const openSidebar = (path = "/dashboard") => render(<MemoryRouter initialEntries={[path]}><SidebarProvider><AppSidebar /></SidebarProvider></MemoryRouter>);

describe("sidebar presentation", () => {
  it("collapses and restores daily menus without removing their links", () => {
    openSidebar();
    const toggle = screen.getByRole("button", { name: /ใช้งานประจำวัน/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector('a[href="/dashboard/academic/schedule"]')).toBeVisible();
  });

  it("opens matching sections during search and clears the search", () => {
    openSidebar();
    fireEvent.click(screen.getByRole("button", { name: /ฝ่ายงานและบริการ/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "ค้นหาเมนู" }), { target: { value: "วัดผล" } });
    expect(screen.getByRole("button", { name: /ฝ่ายงานและบริการ/ })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "ล้างคำค้น" }));
    expect(screen.getByRole("textbox", { name: "ค้นหาเมนู" })).toHaveValue("");
  });

  it("highlights the parent department on a PP page and keeps it expanded", () => {
    openSidebar("/dashboard/academic/pp5");
    expect(document.querySelector('a[aria-current="page"][href*="assessment"]')).toBeVisible();
    const toggle = screen.getByRole("button", { name: /ฝ่ายงานและบริการ/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});