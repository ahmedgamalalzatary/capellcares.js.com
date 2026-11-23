import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    // The auth provider is mocked as hydrated; tell the real API client the session is restored too.
    setAdminAuthHydrated(true);
  });

  it("shows a 403 state for non-admin ERP users", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff" },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(createElement(StaffManagementPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("إدارة فريق العمل متاحة للمسؤول الرئيسي فقط.")).toBeInTheDocument();
  });

  it("loads and shows staff records for admin users", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin" },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });

    // Routed by URL because AdminShell also polls the global order review flags feed.
    mockedFetch.mockImplementation(async (input: unknown) => {
      const path = String(input);
      if (path.includes("/orders/review-flags")) {
        return { ok: true, status: 200, json: async () => ({ items: [] }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 11,
              name: "Orders Staff",
              email: "orders-staff@capella.test",
              role: "staff",
              isActive: true,
              permissionKeys: ["orders.read", "orders.update_payment_status"]
            }
          ]
        })
      };
    });

    render(createElement(StaffManagementPage));

    await waitFor(() => {
      expect(screen.getByText("orders-staff@capella.test")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /إضافة عضو/i })).toHaveAttribute("href", "/staff/new");
    expect(screen.getByRole("link", { name: "تعديل" })).toHaveAttribute("href", "/staff/11/edit");
    expect(screen.queryByText("orders.update_payment_status")).not.toBeInTheDocument();
    expect(mockedFetch.mock.calls.filter(([input]) => !String(input).includes("/orders/review-flags"))).toHaveLength(1);
  });

  it("permanently deletes a staff member after the admin confirms", async () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin" },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });
    mockedFetch.mockImplementation(async (input: unknown, init?: RequestInit) => {
      const path = String(input);
      if (path.includes("/orders/review-flags")) {
        return { ok: true, status: 200, json: async () => ({ items: [] }) };
      }
      if (init?.method === "DELETE") {
        return { ok: true, status: 204, json: async () => null };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: 11, name: "Orders Staff", email: "orders-staff@capella.test", role: "staff", isActive: true, permissionKeys: [] },
            { id: 12, name: "Sales Staff", email: "sales-staff@capella.test", role: "staff", isActive: true, permissionKeys: [] }
          ]
        })
      };
    });

    render(createElement(StaffManagementPage));
    await waitFor(() => expect(screen.getByText("orders-staff@capella.test")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "حذف Orders Staff" }));
    const dialog = await screen.findByRole("dialog", { name: "حذف العضو نهائيًا" });
    expect(within(dialog).getByText(/Orders Staff/)).toBeInTheDocument();
    expect(mockedFetch.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "حذف نهائي" }));

    await waitFor(() => expect(screen.queryByText("orders-staff@capella.test")).not.toBeInTheDocument());
    expect(screen.getByText("sales-staff@capella.test")).toBeInTheDocument();
    const deleteCall = mockedFetch.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "DELETE");
    expect(String(deleteCall?.[0])).toMatch(/\/api\/erp\/staff\/11$/);
  });
});
