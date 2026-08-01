import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hardDeleteProduct = vi.fn();
const hardDeleteCategory = vi.fn();
const hardDeleteOffer = vi.fn();
const restoreProduct = vi.fn();
const restoreCategory = vi.fn();
const restoreOffer = vi.fn();
const { apiGet, apiPost, apiDel, showErrorToast } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDel: vi.fn(),
  showErrorToast: vi.fn()
}));
const useAdminAuth = vi.fn(() => ({
  user: {
    name: "Admin User",
    email: "admin@capella.test",
    role: "admin" as "admin" | "staff",
    permissionKeys: [
      "trash.read",
      "products.restore",
      "products.permanent_delete",
      "categories.restore",
      "categories.permanent_delete",
      "offers.restore",
      "offers.permanent_delete"
    ]
  }
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: any) => createElement("div", null, children)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => useAdminAuth()
}));

vi.mock("@/lib/api/client", () => ({ api: { get: apiGet, post: apiPost, del: apiDel } }));
vi.mock("@/lib/errors", () => ({ showErrorToast }));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector({
    products: [{
      id: 7,
      sku: "SKU-7",
      slug: "p7",
      name: { ar: "منتج محذوف", en: "Deleted Product" },
      description: { ar: "", en: "" },
      ingredients: { ar: "", en: "" },
      howToUse: { ar: "", en: "" },
      warnings: { ar: "", en: "" },
      keywords: [],
      buyingPrice: 0,
      imagePath: "",
      status: "inactive",
      isNew: false,
      isBestseller: false,
      categoryId: 1,
      variants: [],
      createdAt: "",
      updatedAt: "",
      deletedAt: "2026-05-20T00:00:00Z"
    }],
    categories: [{
      id: 3,
      parentId: null,
      slug: "cat",
      name: { ar: "قسم محذوف", en: "Deleted Category" },
      isLeaf: true,
      deletedAt: "2026-05-20T00:00:00Z"
    }],
    offers: [{
      id: 5,
      name: { ar: "عرض محذوف", en: "Deleted Offer" },
      deletedAt: "2026-05-20T00:00:00Z"
    }]
  }),
  getStore: () => ({
    hardDeleteProduct,
    hardDeleteCategory,
    hardDeleteOffer,
    restoreProduct,
    restoreCategory,
    restoreOffer
  })
}));

import TrashPage from "@/app/trash/page";

describe("TrashPage hard delete", () => {
  beforeEach(() => {
    hardDeleteProduct.mockReset();
    hardDeleteCategory.mockReset();
    hardDeleteOffer.mockReset();
    restoreProduct.mockReset();
    restoreCategory.mockReset();
    restoreOffer.mockReset();
    apiGet.mockReset();
    apiPost.mockReset();
    apiDel.mockReset();
    showErrorToast.mockReset();
    apiGet.mockResolvedValue({
      items: [{ id: 11, customerName: "Sara Ali", customerEmail: "sara@test", entityType: "product", entityId: 7, entityName: { ar: "غسول", en: "Cleanser" }, orderId: 3, orderCode: "CAP-3", rating: 5, comment: "ممتاز", status: "active", deletedAt: "2026-08-01T00:00:00Z", createdAt: "2026-07-30T00:00:00Z" }],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 }
    });
    apiPost.mockResolvedValue({ ok: true });
    apiDel.mockResolvedValue({ ok: true });
    useAdminAuth.mockReturnValue({
      user: {
        name: "Admin User",
        email: "admin@capella.test",
        role: "admin",
        permissionKeys: [
          "trash.read",
          "products.restore",
          "products.permanent_delete",
          "categories.restore",
          "categories.permanent_delete",
          "offers.restore",
          "offers.permanent_delete"
        ]
      }
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the hard-delete button on the products tab", () => {
    render(createElement(TrashPage));
    expect(screen.getByRole("button", { name: /حذف نهائي/ })).toBeInTheDocument();
  });

  it("opens a confirmation modal and does nothing when cancelled", () => {
    render(createElement(TrashPage));

    fireEvent.click(screen.getByRole("button", { name: /حذف نهائي/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/تأكيد الحذف النهائي/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
    expect(hardDeleteProduct).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls hardDeleteProduct when the modal confirm button is clicked", async () => {
    hardDeleteProduct.mockResolvedValue(undefined);
    render(createElement(TrashPage));

    fireEvent.click(screen.getByRole("button", { name: /حذف نهائي/ }));
    // confirm button inside the modal — second matching button
    const confirmButtons = screen.getAllByRole("button", { name: /حذف نهائي/ });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
    expect(hardDeleteProduct).toHaveBeenCalledWith(7);
  });

  it("shows the hard-delete button on the categories tab when permission is present", () => {
    render(createElement(TrashPage));
    fireEvent.click(screen.getByRole("button", { name: /الأقسام/ }));
    expect(screen.getByText("حذف نهائي")).toBeInTheDocument();
  });

  it("calls hardDeleteCategory when the categories modal confirm button is clicked", () => {
    hardDeleteCategory.mockResolvedValue(undefined);
    render(createElement(TrashPage));

    fireEvent.click(screen.getByRole("button", { name: /الأقسام/ }));
    fireEvent.click(screen.getByText("حذف نهائي"));
    const confirmButtons = screen.getAllByText("حذف نهائي");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
    expect(hardDeleteCategory).toHaveBeenCalledWith(3);
  });

  it("shows the hard-delete button on the offers tab when permission is present", () => {
    render(createElement(TrashPage));
    fireEvent.click(screen.getByRole("button", { name: /العروض/ }));
    expect(screen.getByText("حذف نهائي")).toBeInTheDocument();
  });

  it("calls hardDeleteOffer when the offers modal confirm button is clicked", () => {
    hardDeleteOffer.mockResolvedValue(undefined);
    render(createElement(TrashPage));

    fireEvent.click(screen.getByRole("button", { name: /العروض/ }));
    fireEvent.click(screen.getByText("حذف نهائي"));
    const confirmButtons = screen.getAllByText("حذف نهائي");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
    expect(hardDeleteOffer).toHaveBeenCalledWith(5);
  });

  it("hides restore and permanent-delete actions when trash access lacks the underlying module permission", () => {
    useAdminAuth.mockReturnValue({
      user: {
        name: "Restricted Staff",
        email: "staff@capella.test",
        role: "staff",
        permissionKeys: ["trash.read"]
      }
    });

    render(createElement(TrashPage));

    expect(screen.queryByRole("button", { name: /استعادة/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /حذف نهائي/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /الأقسام/ }));
    expect(screen.queryByRole("button", { name: /استعادة/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /العروض/ }));
    expect(screen.queryByRole("button", { name: /استعادة/ })).not.toBeInTheDocument();
  });

  it("does not request deleted reviews without trash read permission", async () => {
    useAdminAuth.mockReturnValue({
      user: {
        name: "Review Staff",
        email: "review-staff@capella.test",
        role: "staff",
        permissionKeys: ["reviews.read"]
      }
    });

    render(createElement(TrashPage));

    expect(screen.getByText(/لا تملكين صلاحية الوصول/)).toBeInTheDocument();
    await waitFor(() => expect(apiGet).not.toHaveBeenCalled());
  });

  it("restores reviews from a dedicated trash tab", async () => {
    render(createElement(TrashPage));

    expect(apiGet).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: /التقييمات/ }));
    expect(await screen.findByText("غسول — Sara Ali")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /استعادة/ }));
    expect(apiPost).toHaveBeenCalledWith("/api/erp/reviews/11/restore");
  });

  it("permanently deletes reviews from the dedicated trash tab", async () => {
    render(createElement(TrashPage));

    fireEvent.click(await screen.findByRole("button", { name: /التقييمات/ }));
    expect(await screen.findByText("غسول — Sara Ali")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /حذف نهائي/ }));
    const confirmButtons = screen.getAllByRole("button", { name: /حذف نهائي/ });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
    expect(apiDel).toHaveBeenCalledWith("/api/erp/reviews/11/permanent");
  });

  it("loads every deleted-review page so older reviews remain recoverable", async () => {
    apiGet
      .mockResolvedValueOnce({
        items: [{ id: 11, customerName: "Sara Ali", customerEmail: "sara@test", entityType: "product", entityId: 7, entityName: { ar: "غسول", en: "Cleanser" }, orderId: 3, orderCode: "CAP-3", rating: 5, comment: "ممتاز", status: "active", deletedAt: "2026-08-01T00:00:00Z", createdAt: "2026-07-30T00:00:00Z" }],
        pagination: { page: 1, pageSize: 100, total: 101, totalPages: 2 }
      })
      .mockResolvedValueOnce({
        items: [{ id: 12, customerName: "Mona Said", customerEmail: "mona@test", entityType: "offer", entityId: 9, entityName: { ar: "عرض قديم", en: "Older offer" }, orderId: 4, orderCode: "CAP-4", rating: 4, comment: "جيد", status: "inactive", deletedAt: "2026-07-01T00:00:00Z", createdAt: "2026-06-30T00:00:00Z" }],
        pagination: { page: 2, pageSize: 100, total: 101, totalPages: 2 }
      });

    render(createElement(TrashPage));

    fireEvent.click(await screen.findByRole("button", { name: /التقييمات/ }));
    expect(await screen.findByText("عرض قديم — Mona Said")).toBeInTheDocument();
    expect(apiGet).toHaveBeenNthCalledWith(2, "/api/erp/reviews?deleted=true&page=2&pageSize=100");
  });

  it("shows loading and request errors on the reviews trash tab", async () => {
    let rejectRequest!: (error: Error) => void;
    apiGet.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectRequest = reject; }));
    render(createElement(TrashPage));

    fireEvent.click(document.querySelectorAll("button")[3]!);
    expect(screen.getByRole("status")).toBeInTheDocument();
    rejectRequest(new Error("trash failed"));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), expect.any(String));
  });

  it("keeps a deleted review visible and surfaces restore failures", async () => {
    apiPost.mockRejectedValueOnce(new Error("restore failed"));
    render(createElement(TrashPage));

    fireEvent.click(document.querySelectorAll("button")[3]!);
    expect(await screen.findByText(/Sara Ali/)).toBeInTheDocument();
    fireEvent.click(document.querySelectorAll("button")[4]!);

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), expect.any(String)));
    expect(screen.getByText(/Sara Ali/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /حذف نهائي/ }));
    expect(screen.getByRole("dialog")).not.toHaveTextContent("تعذر استعادة التقييم");
  });
});
