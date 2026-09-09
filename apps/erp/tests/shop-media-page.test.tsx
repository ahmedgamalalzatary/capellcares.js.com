import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastSuccess, showErrorToast } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  showErrorToast: vi.fn()
}));

const updateShopMediaSection = vi.fn().mockResolvedValue(undefined);
const replaceAnnouncements = vi.fn().mockResolvedValue(undefined);
const makeMockState = () => ({
  announcementBarStatus: "active" as const,
  announcements: [{
    id: 1,
    arText: "شحن مجاني",
    enText: "Free shipping",
    status: "active" as const,
    sortOrder: 1
  }],
  shopMediaSections: [{
    id: 1,
    slot: 1,
    status: "active",
    items: [{
      id: 11,
      arImagePath: null,
      arMobileImagePath: null,
      enImagePath: "/uploads/original.jpg",
      enMobileImagePath: "/uploads/original-mobile.jpg",
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
    updateShopMediaSection,
    replaceAnnouncements
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

function openAnnouncementsTab() {
  fireEvent.click(screen.getByRole("tab", { name: "شريط الإعلانات" }));
}

describe("ShopMediaPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
    mockState = makeMockState();
  });

  it("defaults to image sections and lists that tab before announcements", () => {
    render(createElement(ShopMediaPage));

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["أقسام الصور", "شريط الإعلانات"]);
    expect(screen.getByRole("tab", { name: "أقسام الصور" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("button", { name: "حفظ القسم" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "إضافة إعلان" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "شريط الإعلانات" }));

    expect(screen.getByRole("tab", { name: "شريط الإعلانات" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "إضافة إعلان" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "حفظ القسم" })).not.toBeInTheDocument();
  });

  it("saves a master announcement-bar visibility toggle separately from each quote", () => {
    render(createElement(ShopMediaPage));
    openAnnouncementsTab();

    fireEvent.click(screen.getByRole("checkbox", { name: "تفعيل شريط الإعلانات" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ الإعلانات" }));

    expect(replaceAnnouncements).toHaveBeenCalledWith(expect.objectContaining({
      barStatus: "inactive",
      items: [expect.objectContaining({ status: "active", arText: "شحن مجاني" })]
    }));
  });

  it("collapses and expands each announcement quote like an image item", () => {
    render(createElement(ShopMediaPage));
    openAnnouncementsTab();

    expect(screen.getByLabelText("النص العربي")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "طي العنصر" }));

    expect(screen.queryByLabelText("النص العربي")).not.toBeInTheDocument();
    expect(screen.getByText(/شحن مجاني/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "توسيع العنصر" }));

    expect(screen.getByLabelText("النص العربي")).toBeInTheDocument();
  });

  it("collapses the announcement quotes list like an image section", () => {
    render(createElement(ShopMediaPage));
    openAnnouncementsTab();

    fireEvent.click(screen.getByRole("button", { name: "طي القسم" }));

    expect(screen.queryByRole("button", { name: "إضافة إعلان" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("النص العربي")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "توسيع القسم" }));

    expect(screen.getByRole("button", { name: "إضافة إعلان" })).toBeInTheDocument();
    expect(screen.getByLabelText("النص العربي")).toBeInTheDocument();
  });

  it("keeps newly added quotes unique after a quote is removed", () => {
    render(createElement(ShopMediaPage));
    openAnnouncementsTab();

    fireEvent.click(screen.getByRole("button", { name: "إضافة إعلان" }));
    fireEvent.click(screen.getAllByRole("button", { name: "إزالة" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "إضافة إعلان" }));

    const arabicFields = screen.getAllByLabelText("النص العربي") as HTMLInputElement[];
    const englishFields = screen.getAllByLabelText("English text") as HTMLInputElement[];
    expect(arabicFields).toHaveLength(2);
    fireEvent.change(arabicFields[0]!, { target: { value: "الأولى" } });
    fireEvent.change(englishFields[0]!, { target: { value: "First" } });
    fireEvent.change(arabicFields[1]!, { target: { value: "الثانية" } });
    fireEvent.change(englishFields[1]!, { target: { value: "Second" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الإعلانات" }));

    expect(replaceAnnouncements).toHaveBeenCalledWith({
      barStatus: "active",
      items: [
        expect.objectContaining({ arText: "الأولى", enText: "First" }),
        expect.objectContaining({ arText: "الثانية", enText: "Second" })
      ]
    });
  });

  it("adds and saves announcement messages on the shop-media page", () => {
    render(createElement(ShopMediaPage));
    openAnnouncementsTab();

    fireEvent.click(screen.getByRole("button", { name: "إضافة إعلان" }));
    const arabicFields = screen.getAllByLabelText("النص العربي") as HTMLInputElement[];
    const englishFields = screen.getAllByLabelText("English text") as HTMLInputElement[];
    fireEvent.change(arabicFields[1]!, { target: { value: "عرض جديد" } });
    fireEvent.change(englishFields[1]!, { target: { value: "New offer" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الإعلانات" }));

    expect(replaceAnnouncements).toHaveBeenCalledWith({
      barStatus: "active",
      items: [
        expect.objectContaining({ arText: "شحن مجاني", enText: "Free shipping", status: "active" }),
        expect.objectContaining({ arText: "عرض جديد", enText: "New offer", status: "active" })
      ]
    });
  });

  it("blocks saving announcements with empty text", async () => {
    render(createElement(ShopMediaPage));
    openAnnouncementsTab();

    fireEvent.change(screen.getByLabelText("النص العربي"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الإعلانات" }));

    expect(replaceAnnouncements).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(
        expect.any(Error),
        "أضيفي النص العربي والإنجليزي لكل إعلان قبل الحفظ."
      );
    });
  });

  it("edits and saves Arabic and English desktop and mobile images", () => {
    render(createElement(ShopMediaPage));


    for (const label of [
      "صورة سطح المكتب — العربية",
      "صورة الموبايل — العربية",
      "صورة سطح المكتب — الإنجليزية",
      "صورة الموبايل — الإنجليزية"
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
    }
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).toHaveBeenCalledWith(1, expect.objectContaining({
      items: [expect.objectContaining({
        arImagePath: "/uploads/changed-صورة سطح المكتب — العربية.jpg",
        arMobileImagePath: "/uploads/changed-صورة الموبايل — العربية.jpg",
        enImagePath: "/uploads/changed-صورة سطح المكتب — الإنجليزية.jpg",
        enMobileImagePath: "/uploads/changed-صورة الموبايل — الإنجليزية.jpg"
      })]
    }));
  });

  it("keeps unsaved image edits when store data refreshes", async () => {
    const view = render(createElement(ShopMediaPage));


    fireEvent.click(screen.getAllByText("صورة سطح المكتب — الإنجليزية")[0]!);

    mockState = makeMockState();
    view.rerender(createElement(ShopMediaPage));

    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).toHaveBeenCalledWith(1, expect.objectContaining({
      items: [expect.objectContaining({
        enImagePath: "/uploads/changed-صورة سطح المكتب — الإنجليزية.jpg",
        enMobileImagePath: "/uploads/original-mobile.jpg"
      })]
    }));
  });

  it("saves edited section items", async () => {
    render(createElement(ShopMediaPage));


    fireEvent.click(screen.getAllByText("صورة سطح المكتب — الإنجليزية")[0]!);
    fireEvent.click(screen.getAllByText("صورة الموبايل — الإنجليزية")[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ القسم" })[0]!);

    expect(updateShopMediaSection).toHaveBeenCalledWith(1, expect.objectContaining({
      status: "active",
      items: [expect.objectContaining({
        enImagePath: "/uploads/changed-صورة سطح المكتب — الإنجليزية.jpg",
        enMobileImagePath: "/uploads/changed-صورة الموبايل — الإنجليزية.jpg",
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
          arImagePath: null,
          arMobileImagePath: null,
          enImagePath: "/uploads/desktop.jpg",
          enMobileImagePath: null as any,
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
        enImagePath: "/uploads/desktop.jpg",
        enMobileImagePath: null
      })]
    }));
  });

  it("shows an error toast when saving fails", async () => {
    updateShopMediaSection.mockRejectedValueOnce(new Error("save failed"));
    render(createElement(ShopMediaPage));


    fireEvent.click(screen.getAllByText("صورة سطح المكتب — الإنجليزية")[0]!);
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
          arImagePath: null,
          arMobileImagePath: null,
          enImagePath: "/uploads/original.jpg",
          enMobileImagePath: null,
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
          arImagePath: null,
          arMobileImagePath: null,
          enImagePath: "/uploads/original.jpg",
          enMobileImagePath: null,
          targetType: "product",
          targetId: 2,
          sortOrder: 1
        }]
      }],
      products: [{ id: 2, name: { ar: "لوشن للجسم", en: "Body Lotion" }, deletedAt: "2026-01-01T00:00:00.000Z" }]
    };

    render(createElement(ShopMediaPage));


    fireEvent.click(screen.getAllByText("صورة الموبايل — الإنجليزية")[0]!);
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
          { id: 11, arImagePath: null, arMobileImagePath: null, enImagePath: "/uploads/a.jpg", enMobileImagePath: null, targetType: "product", targetId: 1, sortOrder: 1 },
          { id: 12, arImagePath: null, arMobileImagePath: null, enImagePath: "/uploads/b.jpg", enMobileImagePath: null, targetType: "offer", targetId: 1, sortOrder: 2 },
          { id: 13, arImagePath: null, arMobileImagePath: null, enImagePath: "/uploads/c.jpg", enMobileImagePath: null, targetType: "collection", targetId: 1, sortOrder: 3 }
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
          arImagePath: null,
          arMobileImagePath: null,
          enImagePath: "/uploads/original.jpg",
          enMobileImagePath: "/uploads/original-mobile.jpg",
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
