import { createElement, Suspense } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: [] },
  hydrated: true,
  logout: vi.fn()
}));
const apiGet = vi.fn();
const apiPut = vi.fn();

vi.mock("@/lib/api/client", () => ({
  api: {
    get: (path: string) => apiGet(path),
    put: (path: string, body?: unknown) => apiPut(path, body)
  }
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: any) => createElement("div", null, children)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  notFound: () => {
    throw new Error("notFound");
  }
}));

import StaffEditPage from "@/app/staff/[id]/edit/page";

describe("StaffEditPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockedUseAdminAuth.mockReset();
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin", permissionKeys: [] },
      hydrated: true,
      logout: vi.fn()
    });
    apiGet.mockReset();
    apiPut.mockReset();
  });

  it("shows a 403 state for non-admin ERP users", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@minikoshk.test", role: "staff", permissionKeys: [] },
      hydrated: true,
      logout: vi.fn()
    });

    await act(async () => {
      render(
        createElement(
          Suspense,
          { fallback: null },
          createElement(StaffEditPage, { params: Promise.resolve({ id: "11" }) })
        )
      );
    });

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("إدارة فريق العمل متاحة للمسؤول الرئيسي فقط.")).toBeInTheDocument();
  });

  it("loads the selected staff member and permission catalog", async () => {
    apiGet
      .mockResolvedValueOnce({
        item: {
          id: 11,
          name: "Orders Staff",
          email: "orders-staff@minikoshk.test",
          role: "staff",
          isActive: true,
          permissionKeys: ["orders.read", "orders.update_payment_status"]
        }
      })
      .mockResolvedValueOnce({
        items: [
          { key: "products.read", dependencies: [] },
          { key: "orders.update_payment_status", dependencies: ["orders.read"] }
        ]
      });

    await act(async () => {
      render(
        createElement(
          Suspense,
          { fallback: null },
          createElement(StaffEditPage, { params: Promise.resolve({ id: "11" }) })
        )
      );
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Orders Staff")).toBeInTheDocument();
    });

    expect(apiGet).toHaveBeenNthCalledWith(1, "/api/erp/staff/11");
    expect(apiGet).toHaveBeenNthCalledWith(2, "/api/erp/staff/permissions");
    expect(screen.getByDisplayValue("orders-staff@minikoshk.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "حفظ التعديلات" })).toBeInTheDocument();
  });
});
