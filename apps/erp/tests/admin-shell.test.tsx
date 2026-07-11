import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseAdminAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/sales"
}));

vi.mock("next/link", () => ({
  default: (props: any) => {
    const { children, href, ...rest } = props;
    return createElement("a", { href, ...rest }, children);
  }
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

import { AdminShell } from "@/components/shell/admin-shell";

describe("AdminShell", () => {
  beforeEach(() => {
    mockedUseAdminAuth.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the staff management navigation item for admin users", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin" },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    const staffLinks = screen.getAllByText("فريق العمل");
    expect(staffLinks.length).toBeGreaterThan(0);
  });

  it("hides the staff management navigation item for staff users", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["sales.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    expect(screen.queryByText("فريق العمل")).not.toBeInTheDocument();
  });

  it("includes a visible sales navigation item", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["dashboard.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    const salesLinks = screen.getAllByText("المبيعات");
    expect(salesLinks.length).toBeGreaterThan(0);
  });

  it("includes a visible collections navigation item", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["dashboard.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    const collectionLinks = screen.getAllByText("المجموعات");
    expect(collectionLinks.length).toBeGreaterThan(0);
  });

  it("shows reviews navigation only when staff has reviews.read", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["reviews.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    expect(screen.getAllByText("المراجعات").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("الطلبات")).toHaveLength(0);
  });

  it("shows only authorized module navigation items for staff users", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: {
        name: "Staff User",
        email: "staff@capella.test",
        role: "staff",
        permissionKeys: ["dashboard.read", "orders.read", "sales.read"]
      },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    expect(screen.getAllByText("الرئيسية").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الطلبات").length).toBeGreaterThan(0);
    expect(screen.getAllByText("المبيعات").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("المنتجات")).toHaveLength(0);
    expect(screen.queryAllByText("الأقسام")).toHaveLength(0);
    expect(screen.queryAllByText("المحذوفات")).toHaveLength(0);
    expect(screen.queryAllByText("فريق العمل")).toHaveLength(0);
  });
});
