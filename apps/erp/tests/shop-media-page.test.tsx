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
      mobileImagePath: "/uploads/original-mobile.jpg",
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

let mockState: any = makeMockState();

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
  ImageUpload: ({ onChange, label }: any) => createElement("button", { type: "button", onClick: () => onChange(`/uploads/changed-${label}.jpg`) }, label ?? "image-upload")
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

    fireEvent.click(screen.getAllByText("صورة سطح المكتب")[0]!);

    mockState = makeMockState();
    view.rerender(createElement(ShopMediaPage));

    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).toHaveBeenCalledWith(1, expect.objectContaining({
      items: [expect.objectContaining({
        imagePath: "/uploads/changed-صورة سطح المكتب.jpg",
        mobileImagePath: "/uploads/original-mobile.jpg"
      })]
    }));
  });

  it("saves edited section items", async () => {
    render(createElement(ShopMediaPage));

    fireEvent.click(screen.getAllByText("صورة سطح المكتب")[0]!);
    fireEvent.click(screen.getAllByText("صورة الموبايل")[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).toHaveBeenCalledWith(1, expect.objectContaining({
      status: "active",
      items: [expect.objectContaining({
        imagePath: "/uploads/changed-صورة سطح المكتب.jpg",
        mobileImagePath: "/uploads/changed-صورة الموبايل.jpg",
        targetType: "offers"
      })]
    }));
  });

  it("shows an error toast when local validation blocks save", async () => {
    render(createElement(ShopMediaPage));

    fireEvent.change(screen.getByLabelText("نوع الوجهة"), {
      target: { value: "product" }
    });
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), "أضيفي صورة واحدة على الأقل وحددي الوجهة المطلوبة لكل عنصر قبل الحفظ.");
    });
  });

  it("allows saving with only desktop image provided", () => {
    mockState = {
      ...makeMockState(),
      shopMediaSections: [{
        id: 1,
        slot: 1,
        status: "active",
        items: [{
          id: 11,
          imagePath: "/uploads/desktop.jpg",
          mobileImagePath: null as any,
          targetType: "offers",
          targetId: null,
          sortOrder: 1
        }]
      }]
    };
    render(createElement(ShopMediaPage));

    fireEvent.click(screen.getAllByRole("checkbox", { name: "تفعيل القسم" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).toHaveBeenCalledWith(1, expect.objectContaining({
      items: [expect.objectContaining({
        imagePath: "/uploads/desktop.jpg",
        mobileImagePath: null
      })]
    }));
  });

  it("shows an error toast when saving fails", async () => {
    updateShopMediaSection.mockRejectedValueOnce(new Error("save failed"));
    render(createElement(ShopMediaPage));

    fireEvent.click(screen.getAllByText("صورة سطح المكتب")[0]!);
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

  it("warns that a banner whose target was deleted now falls back to the home page", () => {
    mockState = {
      ...makeMockState(),
      shopMediaSections: [{
        id: 1,
        slot: 1,
        status: "active",
        items: [{
          id: 11,
          imagePath: "/uploads/original.jpg",
          mobileImagePath: null,
          targetType: "product",
          targetId: 2,
          sortOrder: 1
        }]
      }],
      products: [
        { id: 1, name: { ar: "منتج حي", en: "Live" } },
        { id: 2, name: { ar: "لوشن للجسم", en: "Body Lotion" }, deletedAt: "2026-01-01T00:00:00.000Z" }
      ]
    };

    render(createElement(ShopMediaPage));

    expect(screen.getByText(/الصفحة الرئيسية/)).toBeInTheDocument();
  });

  it("blocks saving a section whose target was deleted, with a specific reason", async () => {
    mockState = {
      ...makeMockState(),
      shopMediaSections: [{
        id: 1,
        slot: 1,
        status: "active",
        items: [{
          id: 11,
          imagePath: "/uploads/original.jpg",
          mobileImagePath: null,
          targetType: "product",
          targetId: 2,
          sortOrder: 1
        }]
      }],
      products: [{ id: 2, name: { ar: "لوشن للجسم", en: "Body Lotion" }, deletedAt: "2026-01-01T00:00:00.000Z" }]
    };

    render(createElement(ShopMediaPage));

    fireEvent.click(screen.getAllByText("صورة الموبايل")[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(
        expect.any(Error),
        "العنصر المرتبط بإحدى الصور محذوف. اختاري عنصرًا جديدًا قبل الحفظ."
      );
    });
  });

  it("never offers soft-deleted products, offers, or collections as targets", () => {
    mockState = {
      ...makeMockState(),
      shopMediaSections: [{
        id: 1,
        slot: 1,
        status: "active",
        items: [
          { id: 11, imagePath: "/uploads/a.jpg", mobileImagePath: null, targetType: "product", targetId: 1, sortOrder: 1 },
          { id: 12, imagePath: "/uploads/b.jpg", mobileImagePath: null, targetType: "offer", targetId: 1, sortOrder: 2 },
          { id: 13, imagePath: "/uploads/c.jpg", mobileImagePath: null, targetType: "collection", targetId: 1, sortOrder: 3 }
        ]
      }],
      products: [
        { id: 1, name: { ar: "منتج حي", en: "Live" } },
        { id: 2, name: { ar: "منتج محذوف", en: "Deleted" }, deletedAt: "2026-01-01T00:00:00.000Z" }
      ],
      offers: [
        { id: 1, name: { ar: "عرض حي", en: "Live" } },
        { id: 2, name: { ar: "عرض محذوف", en: "Deleted" }, deletedAt: "2026-01-01T00:00:00.000Z" }
      ],
      collections: [
        { id: 1, name: { ar: "مجموعة حية", en: "Live" } },
        { id: 2, name: { ar: "مجموعة محذوفة", en: "Deleted" }, deletedAt: "2026-01-01T00:00:00.000Z" }
      ]
    };

    render(createElement(ShopMediaPage));

    const [productSelect, offerSelect, collectionSelect] = screen.getAllByLabelText("العنصر") as HTMLSelectElement[];
    const optionLabels = (select: HTMLSelectElement) =>
      Array.from(select.querySelectorAll("option")).map((option) => option.textContent);

    expect(optionLabels(productSelect!)).toEqual(["اختاري عنصرًا", "منتج حي"]);
    expect(optionLabels(offerSelect!)).toEqual(["اختاري عنصرًا", "عرض حي"]);
    expect(optionLabels(collectionSelect!)).toEqual(["اختاري عنصرًا", "مجموعة حية"]);
  });

  it("lists category targets in the same tree order as the products filter", () => {
    mockState = {
      ...makeMockState(),
      shopMediaSections: [{
        id: 1,
        slot: 1,
        status: "active",
        items: [{
          id: 11,
          imagePath: "/uploads/original.jpg",
          mobileImagePath: "/uploads/original-mobile.jpg",
          targetType: "category",
          targetId: 2,
          sortOrder: 1
        }]
      }],
      categories: [
        { id: 3, parentId: 1, slug: "body-oil", name: { ar: "Body Oil", en: "Body Oil" }, isLeaf: true, sortOrder: 2 },
        { id: 1, parentId: null, slug: "body", name: { ar: "Body", en: "Body" }, isLeaf: false, sortOrder: 1 },
        { id: 5, parentId: 2, slug: "oily-skin", name: { ar: "Oily Skin", en: "Oily Skin" }, isLeaf: true, sortOrder: 1 },
        { id: 2, parentId: null, slug: "skin", name: { ar: "Skin", en: "Skin" }, isLeaf: false, sortOrder: 2 },
        { id: 4, parentId: 1, slug: "body-lotion", name: { ar: "Body Lotion", en: "Body Lotion" }, isLeaf: true, sortOrder: 1 },
        { id: 6, parentId: null, slug: "removed", name: { ar: "Removed", en: "Removed" }, isLeaf: true, sortOrder: 3, deletedAt: "2026-01-01T00:00:00.000Z" }
      ]
    };

    render(createElement(ShopMediaPage));

    const select = screen.getByLabelText("العنصر") as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option")).map((option) => option.textContent);

    expect(options).toEqual([
      "اختاري عنصرًا",
      "Body",
      "— Body Lotion",
      "— Body Oil",
      "Skin",
      "— Oily Skin"
    ]);
  });

});
