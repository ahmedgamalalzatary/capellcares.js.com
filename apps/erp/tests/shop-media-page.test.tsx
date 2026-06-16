import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastSuccess, showErrorToast } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  showErrorToast: vi.fn()
}));

const updateShopMediaSection = vi.fn().mockResolvedValue(undefined);
const makeMockState = () => ({
  shopMediaSections: [{
    id: 1,
    slot: 1,
    status: "active",
    items: [{
      id: 11,
      imagePath: "/uploads/original.jpg",
      targetType: "offers",
      targetId: null,
      sortOrder: 1
    }]
  }],
  products: [],
  categories: [],
  offers: [],
  collections: []
});

let mockState = makeMockState();

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({
    user: {
      name: "Admin User",
      email: "admin@capella.test",
      role: "admin",
      permissionKeys: ["shop_media.read", "shop_media.update", "products.read", "categories.read", "offers.read", "collections.read"]
    },
    hydrated: true,
    logout: vi.fn()
  })
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/components/forms/image-upload", () => ({
  ImageUpload: ({ onChange }: any) => createElement("button", { type: "button", onClick: () => onChange("/uploads/changed.jpg") }, "image-upload")
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector(mockState),
  getStore: () => ({
    updateShopMediaSection
  })
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess
  }
}));

vi.mock("@/lib/errors", () => ({
  showErrorToast
}));

import ShopMediaPage from "@/app/shop-media/page";

describe("ShopMediaPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockState = makeMockState();
  });

  it("keeps unsaved image edits when store data refreshes", async () => {
    const view = render(createElement(ShopMediaPage));

    fireEvent.click(screen.getAllByText("image-upload")[0]!);

    mockState = makeMockState();
    view.rerender(createElement(ShopMediaPage));

    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).toHaveBeenCalledWith(1, expect.objectContaining({
      items: [expect.objectContaining({
        imagePath: "/uploads/changed.jpg"
      })]
    }));
  });

  it("saves edited section items", async () => {
    render(createElement(ShopMediaPage));

    fireEvent.click(screen.getAllByText("image-upload")[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).toHaveBeenCalledWith(1, expect.objectContaining({
      status: "active",
      items: [expect.objectContaining({
        imagePath: "/uploads/changed.jpg",
        targetType: "offers"
      })]
    }));
  });

  it("shows a success toast after saving", async () => {
    render(createElement(ShopMediaPage));

    fireEvent.click(screen.getAllByText("image-upload")[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("تم حفظ القسم بنجاح.");
    });
  });

  it("shows an error toast when local validation blocks save", async () => {
    render(createElement(ShopMediaPage));

    fireEvent.change(screen.getByLabelText("نوع الوجهة"), {
      target: { value: "product" }
    });
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), "أكملي الصورة والوجهة لكل عنصر قبل الحفظ.");
    });
  });

  it("shows an error toast when saving fails", async () => {
    updateShopMediaSection.mockRejectedValueOnce(new Error("save failed"));
    render(createElement(ShopMediaPage));

    fireEvent.click(screen.getAllByText("image-upload")[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), "تعذر حفظ القسم. حاولي مرة أخرى.");
    });
  });

  it("toggles section status with the switch", () => {
    render(createElement(ShopMediaPage));

    const toggle = screen.getAllByRole("checkbox", { name: "تفعيل القسم" })[0]!;
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).toHaveBeenCalledWith(1, expect.objectContaining({
      status: "inactive"
    }));
  });

  it("disables save until there are unsaved changes", () => {
    render(createElement(ShopMediaPage));

    expect(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!).toBeDisabled();

    fireEvent.click(screen.getAllByText("image-upload")[0]!);

    expect(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!).toBeEnabled();
  });
});
