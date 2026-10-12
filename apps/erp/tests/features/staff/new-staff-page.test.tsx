import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseAdminAuth = vi.fn();

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/staff/new"
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    fetchOpenOrderReviewFlags: vi.fn().mockResolvedValue([]),
    resolveOrderReviewFlag: vi.fn()
  })
}));

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

vi.mock("@/lib/api/client", () => ({
  api: { get: apiGet, post: apiPost, put: vi.fn() }
}));

import StaffNewPage from "@/app/staff/new/page";

const permissionItems = [
  { key: "orders.read", module: "orders" },
  { key: "orders.update", module: "orders" },
  { key: "products.read", module: "products" }
];

describe("StaffNewPage", () => {
  beforeEach(() => {
    mockedUseAdminAuth.mockReset();
    apiGet.mockReset();
    apiGet.mockResolvedValue({ items: permissionItems });
    apiPost.mockReset();
    apiPost.mockResolvedValue(undefined);
  });

  it("shows a 403 state for non-admin ERP users and never asks for the permission catalog", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff" },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(StaffNewPage));

    expect(screen.getAllByText("غير مصرح").length).toBeGreaterThan(0);
    expect(screen.getByText("إدارة فريق العمل متاحة للمسؤول الرئيسي فقط.")).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("renders nothing until the saved session has been read", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin" },
      hydrated: false,
      logout: vi.fn()
    });

    const { container } = render(createElement(StaffNewPage));

    expect(container).toBeEmptyDOMElement();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("renders the real staff form with empty values for admin users", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin" },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(StaffNewPage));

    expect(screen.getByText("بيانات العضو")).toBeInTheDocument();
    // The real form, not a stub: its own labelled inputs and the permission catalog it fetched.
    expect(screen.getByLabelText("الاسم")).toHaveValue("");
    expect(screen.getByLabelText("البريد الإلكتروني")).toHaveValue("");
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/api/erp/staff/permissions"));
    expect(await screen.findByRole("checkbox", { name: "الطلبات / عرض" })).toBeInTheDocument();
  });

  it("creates the staff member with the typed details and the ticked permissions", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin" },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(StaffNewPage));

    fireEvent.change(screen.getByLabelText("الاسم"), { target: { value: "سارة" } });
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "sara@capella.test" } });
    fireEvent.change(screen.getByLabelText(/كلمة المرور/), { target: { value: "secret123" } });
    fireEvent.click(await screen.findByRole("checkbox", { name: "الطلبات / عرض" }));
    fireEvent.click(screen.getByRole("button", { name: "إنشاء العضو" }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/erp/staff", {
      name: "سارة",
      email: "sara@capella.test",
      password: "secret123",
      isActive: true,
      permissionKeys: ["orders.read"]
    }));
  });

  it("keeps the submitted values and shows the server message when creating fails", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin" },
      hydrated: true,
      logout: vi.fn()
    });
    apiPost.mockRejectedValue(
      Object.assign(new Error("API 409"), { status: 409, body: { message: "البريد مستخدم بالفعل" } })
    );

    render(createElement(StaffNewPage));

    fireEvent.change(screen.getByLabelText("الاسم"), { target: { value: "سارة" } });
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "sara@capella.test" } });
    fireEvent.change(screen.getByLabelText(/كلمة المرور/), { target: { value: "secret123" } });
    // Submitting is disabled until the permission catalog has landed.
    await screen.findByRole("checkbox", { name: "الطلبات / عرض" });
    fireEvent.click(screen.getByRole("button", { name: "إنشاء العضو" }));

    expect(await screen.findByText("البريد مستخدم بالفعل")).toBeInTheDocument();
    // The form keeps what was typed so the admin can correct it instead of retyping.
    expect(screen.getByLabelText("الاسم")).toHaveValue("سارة");
    expect(screen.getByRole("button", { name: "إنشاء العضو" })).toBeEnabled();
  });

  it("reports a failed permission catalog load instead of silently offering no permissions", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin" },
      hydrated: true,
      logout: vi.fn()
    });
    apiGet.mockRejectedValue(
      Object.assign(new Error("API 500"), { status: 500, body: { message: "تعذر تحميل الصلاحيات" } })
    );

    render(createElement(StaffNewPage));

    expect(await screen.findByText("تعذر تحميل الصلاحيات")).toBeInTheDocument();
  });
});