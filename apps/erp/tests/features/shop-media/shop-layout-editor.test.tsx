import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastSuccess, showErrorToast, replaceShopLayout } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  showErrorToast: vi.fn(),
  replaceShopLayout: vi.fn()
}));

const picture = (id: number, path: string) => ({
  id,
  status: "active",
  items: [{ id: id * 10, arImagePath: null, arMobileImagePath: null, enImagePath: path, enMobileImagePath: null, targetType: "offers", targetId: null, sortOrder: 1 }]
});

const builtIn = (id: number, type: string, sortOrder: number) => ({ id, type, categoryId: null, mediaSection: null, sortOrder });

// Saved page: a picture section, offers, Cars' products, the newest toys.
const makeMockState = () => ({
  announcementBarStatus: "active" as const,
  announcements: [],
  shopPageBlocks: [
    { id: 1, type: "media", categoryId: null, mediaSection: picture(50, "/uploads/top.jpg"), sortOrder: 1 },
    builtIn(2, "offers", 2),
    { id: 3, type: "category", categoryId: 10, mediaSection: null, sortOrder: 3 },
    builtIn(4, "new", 4)
  ],
  products: [],
  categories: [
    { id: 10, parentId: null, slug: "cars", name: { ar: "سيارات", en: "Cars" }, isLeaf: false },
    { id: 11, parentId: 10, slug: "rc", name: { ar: "ريموت", en: "RC" }, isLeaf: true },
    { id: 12, parentId: null, slug: "dolls", name: { ar: "عرائس", en: "Dolls" }, isLeaf: true },
    { id: 13, parentId: null, slug: "old", name: { ar: "قديم", en: "Old" }, isLeaf: true, deletedAt: "2026-01-01T00:00:00Z" }
  ],
  offers: [],
  collections: []
});

let mockState: any = makeMockState();
let permissionKeys = ["shop_media.read", "shop_media.update"];

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({
    user: { name: "Admin", email: "admin@capella.test", role: "staff", permissionKeys },
    hydrated: true,
    logout: vi.fn()
  })
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/components/forms/single-image-field", () => ({
  SingleImageField: ({ onChange, label }: any) => createElement("button", { type: "button", onClick: () => onChange(`/uploads/changed-${label}.jpg`) }, label)
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector(mockState),
  getStore: () => ({ replaceShopLayout, replaceAnnouncements: vi.fn() })
}));

vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
vi.mock("@/lib/errors", () => ({ showErrorToast }));

import ShopMediaPage from "@/app/shop-media/page";

function openLayout() {
  render(createElement(ShopMediaPage));
}

const sectionItems = () => screen.getAllByRole("listitem").filter((item) => item.hasAttribute("data-shop-section"));
const sectionTitles = () => sectionItems().map((item) => within(item).getAllByRole("heading", { level: 2 })[0]!.textContent);
const save = () => fireEvent.click(screen.getByRole("button", { name: "حفظ الترتيب" }));

describe("shop page layout", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    replaceShopLayout.mockResolvedValue(undefined);
    window.localStorage.clear();
    mockState = makeMockState();
    permissionKeys = ["shop_media.read", "shop_media.update"];
  });

  it("opens on the layout and lists every section in its saved order", () => {
    openLayout();
    expect(screen.getByRole("tab", { name: "ترتيب صفحة المتجر" })).toHaveAttribute("aria-selected", "true");
    expect(sectionTitles()).toEqual(["1. قسم صور", "2. العروض", "3. قسم منتجات", "4. الأحدث"]);
    expect(within(sectionItems()[2]!).getByLabelText("القسم")).toHaveValue("10");
  });

  it("offers to add back only the built-in sections the page does not have", () => {
    openLayout();
    const addButtons = screen.getAllByRole("button", { name: /^إضافة «/ }).map((button) => button.textContent?.trim());
    // Collections is never on the page by default, so it is always offered until it is added.
    expect(addButtons).toEqual(["إضافة «تسوق حسب النوع»", "إضافة «الأقسام»", "إضافة «الأكثر مبيعًا»", "إضافة «الماركات»", "إضافة «المجموعات»"]);
  });

  it("saves the whole page in its new order, keeping a picture section's id", async () => {
    openLayout();
    fireEvent.click(within(sectionItems()[3]!).getByRole("button", { name: "تحريك القسم لأعلى" }));
    fireEvent.click(screen.getByRole("button", { name: "إضافة «الماركات»" }));
    fireEvent.click(screen.getByRole("button", { name: "إضافة «المجموعات»" }));
    // Once on the page, collections is no longer offered.
    expect(screen.queryByRole("button", { name: "إضافة «المجموعات»" })).toBeNull();
    save();

    await waitFor(() => expect(replaceShopLayout).toHaveBeenCalledTimes(1));
    expect(replaceShopLayout).toHaveBeenCalledWith([
      expect.objectContaining({ type: "media", mediaSectionId: 50, status: "active", items: [expect.objectContaining({ enImagePath: "/uploads/top.jpg", sortOrder: 1 })] }),
      { type: "offers" },
      { type: "new" },
      { type: "category", categoryId: 10 },
      { type: "brands" },
      { type: "collections" }
    ]);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("تم حفظ ترتيب صفحة المتجر."));
  });

  it("removes a built-in section, after which it can be added again", () => {
    openLayout();
    fireEvent.click(within(sectionItems()[1]!).getByRole("button", { name: "إزالة القسم" }));
    expect(sectionTitles()).toEqual(["1. قسم صور", "2. قسم منتجات", "3. الأحدث"]);
    expect(screen.getByRole("button", { name: "إضافة «العروض»" })).toBeInTheDocument();
  });

  it("adds a new picture section and saves its images with the page", async () => {
    openLayout();
    fireEvent.click(screen.getByRole("button", { name: "إضافة قسم صور" }));
    const added = sectionItems()[4]!;
    fireEvent.click(within(added).getByRole("button", { name: "أضيفي أول صورة" }));
    fireEvent.click(within(added).getByRole("button", { name: "سطح المكتب — العربية" }));
    save();

    await waitFor(() => expect(replaceShopLayout).toHaveBeenCalledTimes(1));
    expect(replaceShopLayout.mock.calls[0]![0][4]).toEqual(expect.objectContaining({
      type: "media",
      mediaSectionId: null,
      items: [expect.objectContaining({ arImagePath: "/uploads/changed-سطح المكتب — العربية.jpg" })]
    }));
  });

  it("offers each category only once, sub-categories included, and never a deleted one", () => {
    openLayout();
    fireEvent.click(screen.getByRole("button", { name: "إضافة قسم منتجات" }));
    const picker = within(sectionItems()[4]!).getByLabelText("القسم");
    expect(within(picker).getAllByRole("option").map((option) => (option as HTMLOptionElement).value)).toEqual(["", "11", "12"]);
  });

  it("blocks saving a products section with no category chosen", async () => {
    openLayout();
    fireEvent.click(screen.getByRole("button", { name: "إضافة قسم منتجات" }));
    save();

    expect(replaceShopLayout).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), "اختاري قسمًا لكل قسم منتجات قبل الحفظ.");
    });
  });

  it("warns about a category in the trash and blocks saving until it is changed", async () => {
    mockState.shopPageBlocks[2].categoryId = 13;
    openLayout();
    expect(within(sectionItems()[2]!).getByText(/القسم المختار محذوف/)).toBeInTheDocument();
    fireEvent.click(within(sectionItems()[3]!).getByRole("button", { name: "إزالة القسم" }));
    save();

    expect(replaceShopLayout).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), "أحد الأقسام المختارة محذوف. اختاري قسمًا آخر أو أزيلي القسم قبل الحفظ.");
    });
  });

  it("blocks saving an empty page", async () => {
    openLayout();
    for (let count = sectionItems().length; count > 0; count -= 1) {
      fireEvent.click(within(sectionItems()[0]!).getByRole("button", { name: "إزالة القسم" }));
    }
    save();

    expect(replaceShopLayout).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), "أبقي قسمًا واحدًا على الأقل في صفحة المتجر.");
    });
  });

  it("blocks saving a picture section with an image that has no picture", async () => {
    openLayout();
    fireEvent.click(screen.getByRole("button", { name: "إضافة قسم صور" }));
    fireEvent.click(within(sectionItems()[4]!).getByRole("button", { name: "أضيفي أول صورة" }));
    save();

    expect(replaceShopLayout).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), "أضيفي صورة واحدة على الأقل وحددي الوجهة المطلوبة لكل عنصر قبل الحفظ.");
    });
  });

  it("says so when saving fails", async () => {
    replaceShopLayout.mockRejectedValue(new Error("down"));
    openLayout();
    fireEvent.click(within(sectionItems()[1]!).getByRole("button", { name: "إزالة القسم" }));
    save();

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), "تعذر حفظ ترتيب صفحة المتجر. حاولي مرة أخرى.");
    });
  });

  it("keeps unsaved changes when store data refreshes", () => {
    const view = render(createElement(ShopMediaPage));
    fireEvent.click(within(sectionItems()[0]!).getByRole("button", { name: "إزالة القسم" }));
    mockState = makeMockState();
    view.rerender(createElement(ShopMediaPage));
    expect(sectionItems()).toHaveLength(3);
  });

  it("shows the layout read-only without the edit permission", () => {
    permissionKeys = ["shop_media.read"];
    openLayout();
    expect(sectionItems()).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "حفظ الترتيب" })).toBeNull();
    expect(screen.queryByRole("button", { name: "إضافة قسم منتجات" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^إضافة «/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "إزالة القسم" })).toBeNull();
  });
});
