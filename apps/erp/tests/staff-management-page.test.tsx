import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseAdminAuth = vi.fn();
const mockedFetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/staff"
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

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return {
    ...actual,
    API_BASE: ""
  };
});

import StaffManagementPage from "@/app/staff/page";
import { setAdminAuthHydrated } from "@/lib/api/client";

describe("StaffManagementPage", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedUseAdminAuth.mockReset();
    vi.stubGlobal("fetch", mockedFetch);
    setAdminAuthHydrated(true);
  });

  it("shows a 403 state for non-admin ERP users", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@minikoshk.test", role: "staff" },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(StaffManagementPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("إدارة فريق العمل متاحة للمسؤول الرئيسي فقط.")).toBeInTheDocument();
  });

  it("loads and shows staff records for admin users", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@minikoshk.test", role: "admin" },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    mockedFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 11,
              name: "Orders Staff",
              email: "orders-staff@minikoshk.test",
              role: "staff",
              isActive: true,
              permissionKeys: ["orders.read", "orders.update_payment_status"]
            }
          ]
        })
      });

    render(createElement(StaffManagementPage));

    await waitFor(() => {
      expect(screen.getByText("orders-staff@minikoshk.test")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /إضافة عضو/i })).toHaveAttribute("href", "/staff/new");
    expect(screen.getByRole("link", { name: "تعديل" })).toHaveAttribute("href", "/staff/11/edit");
    expect(screen.queryByText("orders.update_payment_status")).not.toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});
