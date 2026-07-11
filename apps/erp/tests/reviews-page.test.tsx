import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockedUseAdminAuth, get, patch, del } = vi.hoisted(() => ({
  mockedUseAdminAuth: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  del: vi.fn()
}));

vi.mock("@/components/providers/admin-auth", () => ({ useAdminAuth: () => mockedUseAdminAuth() }));
vi.mock("@/components/shell/admin-shell", () => ({ AdminShell: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/lib/api/client", () => ({ api: { get, patch, del } }));

import ReviewsPage from "@/app/reviews/page";

afterEach(cleanup);

describe("ERP reviews page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAdminAuth.mockReturnValue({
      user: { role: "admin", permissionKeys: [] }, hydrated: true
    });
    get.mockResolvedValue({ items: [{
      id: 9,
      customerId: 2,
      customerName: "Sara Ahmed",
      customerEmail: "sara@example.com",
      entityType: "product",
      entityId: 4,
      entityName: { ar: "زيت الورد", en: "Rose Oil" },
      rating: 5,
      comment: "رائع",
      status: "pending",
      createdAt: "2026-07-11T09:00:00.000Z"
    }] });
    patch.mockResolvedValue({ id: 9, status: "approved" });
  });

  it("groups reviews by customer and moderates when permitted", async () => {
    render(<ReviewsPage />);
    expect(await screen.findByText("Sara Ahmed")).toBeInTheDocument();
    expect(screen.getByText("sara@example.com")).toBeInTheDocument();
    expect(screen.getByText("زيت الورد")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "اعتماد" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/api/erp/reviews/9/status", { status: "approved" }));
  });

  it("disables moderation actions while a status request is in flight", async () => {
    let resolvePatch!: (value: unknown) => void;
    patch.mockReturnValue(new Promise((resolve) => { resolvePatch = resolve; }));
    render(<ReviewsPage />);
    await screen.findByText("Sara Ahmed");
    fireEvent.click(screen.getByRole("button", { name: "اعتماد" }));
    expect(screen.getByRole("button", { name: "اعتماد" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "رفض" })).toBeDisabled();
    resolvePatch({ id: 9, status: "approved" });
    await waitFor(() => expect(screen.getByRole("button", { name: "إخفاء" })).toBeEnabled());
  });

  it("shows load failures instead of the empty-results state", async () => {
    get.mockRejectedValue(new Error("network"));
    render(<ReviewsPage />);
    expect(await screen.findByText("تعذر تحميل المراجعات. حاولي مرة أخرى.")).toBeInTheDocument();
    expect(screen.queryByText("لا توجد مراجعات مطابقة.")).not.toBeInTheDocument();
  });

  it("reports moderation failures without changing the review status", async () => {
    patch.mockRejectedValue(new Error("network"));
    render(<ReviewsPage />);
    await screen.findByText("Sara Ahmed");
    fireEvent.click(screen.getByRole("button", { name: "اعتماد" }));
    expect(await screen.findByText("تعذر تحديث حالة المراجعة. حاولي مرة أخرى.")).toBeInTheDocument();
    expect(screen.getAllByText("بانتظار المراجعة")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "اعتماد" })).toBeEnabled();
  });

  it("reports deletion failures and keeps the review visible", async () => {
    del.mockRejectedValue(new Error("network"));
    render(<ReviewsPage />);
    await screen.findByText("Sara Ahmed");
    fireEvent.click(screen.getByRole("button", { name: "حذف نهائي" }));
    fireEvent.click(screen.getAllByRole("button", { name: "حذف نهائي" }).at(-1)!);
    expect(await screen.findByText("تعذر حذف المراجعة. حاولي مرة أخرى.")).toBeInTheDocument();
    expect(screen.getByText("زيت الورد")).toBeInTheDocument();
  });

  it("denies staff without reviews.read without loading data", () => {
    mockedUseAdminAuth.mockReturnValue({ user: { role: "staff", permissionKeys: [] }, hydrated: true });
    render(<ReviewsPage />);
    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
