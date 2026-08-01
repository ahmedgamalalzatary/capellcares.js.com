import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, get, post, del, showErrorToast } = vi.hoisted(() => ({
  auth: { user: { name: "Admin", email: "admin@test", role: "admin", permissionKeys: [] as string[] } },
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
  showErrorToast: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ api: { get, post, del } }));
vi.mock("@/lib/errors", () => ({ showErrorToast }));
vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => auth
}));
vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: any) => createElement("div", null, children)
}));

import ReviewsPage from "@/app/reviews/page";

const page = {
  items: [{
    id: 4,
    customerName: "Sara Ali",
    customerEmail: "sara@example.com",
    entityType: "product",
    entityId: 8,
    entityName: { ar: "غسول", en: "Cleanser" },
    orderId: 12,
    orderCode: "CAP-12",
    rating: 5,
    comment: "منتج ممتاز",
    status: "active",
    deletedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z"
  }],
  pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  auth.user = { name: "Admin", email: "admin@test", role: "admin", permissionKeys: [] };
  get.mockResolvedValue(page);
  post.mockResolvedValue({ id: 4, status: "inactive" });
  del.mockResolvedValue({ ok: true });
});

describe("ERP ReviewsPage", () => {
  it("shows verified review context and lets an admin deactivate or soft-delete it", async () => {
    render(createElement(ReviewsPage));

    expect(await screen.findByText("Sara Ali")).toBeInTheDocument();
    expect(screen.getByText("غسول")).toBeInTheDocument();
    expect(screen.getByText("CAP-12").closest("a")).toHaveAttribute("href", "/orders/12");
    expect(screen.getByLabelText("5 من 5 نجوم")).toBeInTheDocument();
    expect(screen.getByText("منتج ممتاز")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تعطيل" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/erp/reviews/4/toggle-status"));

    fireEvent.click(screen.getByRole("button", { name: "حذف" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/api/erp/reviews/4"));
  });

  it("does not request reviews when the staff member lacks read permission", async () => {
    auth.user = { name: "Staff", email: "staff@test", role: "staff", permissionKeys: [] };

    render(createElement(ReviewsPage));

    expect(screen.getByText(/لا تملك صلاحية الوصول/)).toBeInTheDocument();
    await waitFor(() => expect(get).not.toHaveBeenCalled());
  });

  it("surfaces review mutation failures without an unhandled rejection", async () => {
    post.mockRejectedValueOnce(new Error("toggle failed"));
    render(createElement(ReviewsPage));

    fireEvent.click(await screen.findByRole("button", { name: "تعطيل" }));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(
      expect.any(Error),
      "تعذر تحديث التقييم. حاولي مرة أخرى."
    ));
  });

  it("ignores an older response that finishes after a newer search", async () => {
    let resolveInitial!: (value: typeof page) => void;
    let resolveSearch!: (value: typeof page) => void;
    get
      .mockReturnValueOnce(new Promise((resolve) => { resolveInitial = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSearch = resolve; }));

    render(createElement(ReviewsPage));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("البحث في التقييمات"), { target: { value: "new" } });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));

    await act(async () => resolveSearch({
      ...page,
      items: [{ ...page.items[0], id: 20, customerName: "New Result" }]
    }));
    expect(await screen.findByText("New Result")).toBeInTheDocument();

    await act(async () => resolveInitial({
      ...page,
      items: [{ ...page.items[0], id: 21, customerName: "Stale Result" }]
    }));
    expect(screen.queryByText("Stale Result")).not.toBeInTheDocument();
  });
});
