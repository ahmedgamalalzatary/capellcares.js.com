import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPut = vi.fn();
let user: { role: "admin" | "staff"; permissionKeys: string[] } = { role: "admin", permissionKeys: [] };

vi.mock("@/lib/api/client", () => ({ api: { get: (...args: unknown[]) => apiGet(...args), put: (...args: unknown[]) => apiPut(...args) } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/providers/admin-auth", () => ({ useAdminAuth: () => ({ user }) }));
vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ title, actions, children }: any) => (<div><h1>{title}</h1>{actions}{children}</div>)
}));
vi.mock("@/components/admin/permission-gate", () => ({
  ForbiddenPage: ({ message }: any) => <p>{message}</p>
}));

import DeliveryPage from "@/app/delivery/page";

const settings = {
  governorates: [{
    id: 1, arName: "حولي", enName: "Hawalli", status: "active", sortOrder: 0,
    areas: [{ id: 10, arName: "السالمية", enName: "Salmiya", fee: 1.5, status: "active", sortOrder: 0 }]
  }]
};

beforeEach(() => {
  vi.clearAllMocks();
  user = { role: "admin", permissionKeys: [] };
  apiGet.mockResolvedValue(settings);
  apiPut.mockImplementation(async (_path: string, body: any) => ({ governorates: body.governorates.map((g: any, i: number) => ({ id: g.id ?? 100 + i, sortOrder: i, ...g, areas: g.areas.map((a: any, j: number) => ({ id: a.id ?? 200 + j, sortOrder: j, ...a })) })) }));
});
afterEach(cleanup);

describe("Delivery page", () => {
  it("shows each governorate with its areas and fees", async () => {
    render(<DeliveryPage />);
    expect(await screen.findByDisplayValue("حولي")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Salmiya")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1.5")).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/api/erp/delivery");
  });

  it("adds an area with its fee and saves the whole setup", async () => {
    render(<DeliveryPage />);
    await screen.findByDisplayValue("حولي");
    const governorate = screen.getByRole("region", { name: "حولي" });
    fireEvent.click(within(governorate).getByRole("button", { name: "إضافة منطقة" }));
    const arNames = within(governorate).getAllByLabelText("اسم المنطقة بالعربية");
    const enNames = within(governorate).getAllByLabelText("اسم المنطقة بالإنجليزية");
    const fees = within(governorate).getAllByLabelText("رسوم التوصيل");
    fireEvent.change(arNames[1]!, { target: { value: "الجابرية" } });
    fireEvent.change(enNames[1]!, { target: { value: "Jabriya" } });
    fireEvent.change(fees[1]!, { target: { value: "2.125" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ التوصيل" }));

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1));
    expect(apiPut).toHaveBeenCalledWith("/api/erp/delivery", {
      governorates: [{
        id: 1, arName: "حولي", enName: "Hawalli", status: "active",
        areas: [
          { id: 10, arName: "السالمية", enName: "Salmiya", fee: 1.5, status: "active" },
          { arName: "الجابرية", enName: "Jabriya", fee: 2.125, status: "active" }
        ]
      }]
    });
  });

  it("does not save while a fee is missing, and says why", async () => {
    render(<DeliveryPage />);
    await screen.findByDisplayValue("حولي");
    fireEvent.change(screen.getByDisplayValue("1.5"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ التوصيل" }));
    expect(await screen.findByText(/رسوم التوصيل في «السالمية»/)).toBeInTheDocument();
    expect(apiPut).not.toHaveBeenCalled();
  });

  it("adds a governorate", async () => {
    render(<DeliveryPage />);
    await screen.findByDisplayValue("حولي");
    fireEvent.click(screen.getByRole("button", { name: "إضافة محافظة" }));
    expect(screen.getAllByLabelText("اسم المحافظة بالعربية")).toHaveLength(2);
  });

  it("is read-only without the update permission", async () => {
    user = { role: "staff", permissionKeys: ["delivery.read"] };
    render(<DeliveryPage />);
    expect(await screen.findByDisplayValue("حولي")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "حفظ التوصيل" })).toBeNull();
  });

  it("is blocked without the read permission", () => {
    user = { role: "staff", permissionKeys: ["orders.read"] };
    render(<DeliveryPage />);
    expect(screen.getByText("لا تملكين صلاحية الوصول إلى إعدادات التوصيل.")).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });
});
