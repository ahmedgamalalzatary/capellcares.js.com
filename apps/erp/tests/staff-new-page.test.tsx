import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseAdminAuth = vi.fn();

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: any) => createElement("div", null, children)
}));

vi.mock("@/components/admin/staff-editor-form", () => ({
  StaffEditorForm: () => createElement("div", { "data-testid": "staff-editor-form" }),
  createEmptyStaffForm: () => ({
    name: "",
    email: "",
    password: "",
    isActive: true,
    permissionKeys: []
  })
}));

import StaffNewPage from "@/app/staff/new/page";

describe("StaffNewPage", () => {
  beforeEach(() => {
    mockedUseAdminAuth.mockReset();
  });

  it("shows a 403 state for non-admin ERP users", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@minikoshk.test", role: "staff" },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(StaffNewPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("إدارة فريق العمل متاحة للمسؤول الرئيسي فقط.")).toBeInTheDocument();
  });

  it("renders the shared staff create form for admin users", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin" },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(StaffNewPage));

    expect(screen.getByText("إضافة عضو")).toBeInTheDocument();
    expect(screen.getByTestId("staff-editor-form")).toBeInTheDocument();
  });
});
