import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastSuccess, showErrorToast, replaceShopCustomSections } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  showErrorToast: vi.fn(),
  replaceShopCustomSections: vi.fn()
}));

const picture = (id: number, path: string) => ({
  id,
  slot: null,
  status: "active",
  items: [{ id: id * 10, arImagePath: null, arMobileImagePath: null, enImagePath: path, enMobileImagePath: null, targetType: "offers", targetId: null, sortOrder: 1 }]
});

const makeMockState = () => ({
  announcementBarStatus: "active" as const,
  announcements: [],
  shopMediaSections: [{ id: 1, slot: 1, status: "inactive", items: [] }],
  shopCustomBlocks: [
    { id: 1, type: "category", categoryId: 10, mediaSection: null, sortOrder: 1 },
    { id: 2, type: "media", categoryId: null, mediaSection: picture(50, "/uploads/custom.jpg"), sortOrder: 2 }
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
  getStore: () => ({ replaceShopCustomSections, updateShopMediaSection: vi.fn(), replaceAnnouncements: vi.fn() })
}));

vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
vi.mock("@/lib/errors", () => ({ showErrorToast }));

import ShopMediaPage from "@/app/shop-media/page";

function openCustomTab() {
  render(createElement(ShopMediaPage));
  fireEvent.click(screen.getByRole("tab", { name: "الأقسام المخصصة" }));
}

const sectionItems = () => screen.getAllByRole("listitem").filter((item) => item.hasAttribute("data-custom-section"));
const save = () => fireEvent.click(screen.getByRole("button", { name: "حفظ الأقسام" }));

describe("shop custom sections", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    replaceShopCustomSections.mockResolvedValue(undefined);
    window.localStorage.clear();
    mockState = makeMockState();
    permissionKeys = ["shop_media.read", "shop_media.update"];
  });

  it("lists the saved custom sections in order: a category's products, then a picture section", () => {
    openCustomTab();
    const items = sectionItems();
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByLabelText("القسم")).toHaveValue("10");
    expect(within(items[1]!).getByRole("heading", { name: "2. قسم صور" })).toBeInTheDocument();
  });

  it("warns about a section whose category was moved to the trash, and blocks saving until it is fixed", async () => {
    mockState.shopCustomBlocks[0].categoryId = 13;
    openCustomTab();
    expect(within(sectionItems()[0]!).getByText(/القسم المختار محذوف/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "إضافة قسم منتجات" }));
    fireEvent.change(within(sectionItems()[2]!).getByLabelText("القسم"), { target: { value: "12" } });
    save();

    expect(replaceShopCustomSections).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), "أحد الأقسام المختارة محذوف. اختاري قسمًا آخر أو أزيلي القسم قبل الحفظ.");
    });
  });

  it("saves the whole list in its new order, keeping a picture section's id", async () => {
    openCustomTab();
    fireEvent.click(screen.getByRole("button", { name: "إضافة قسم منتجات" }));
    fireEvent.change(within(sectionItems()[2]!).getByLabelText("القسم"), { target: { value: "12" } });
    fireEvent.click(within(sectionItems()[2]!).getByRole("button", { name: "تحريك القسم لأعلى" }));
    save();

    await waitFor(() => expect(replaceShopCustomSections).toHaveBeenCalledTimes(1));
    expect(replaceShopCustomSections).toHaveBeenCalledWith([
      { type: "category", categoryId: 10 },
      { type: "category", categoryId: 12 },
      expect.objectContaining({
        type: "media",
        mediaSectionId: 50,
        status: "active",
        items: [expect.objectContaining({ enImagePath: "/uploads/custom.jpg", sortOrder: 1 })]
      })
    ]);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("adds a new picture section and saves its images with the list", async () => {
    openCustomTab();
    fireEvent.click(screen.getByRole("button", { name: "إضافة قسم صور" }));
    const added = sectionItems()[2]!;
    fireEvent.click(within(added).getByRole("button", { name: "أضيفي أول صورة" }));
    fireEvent.click(within(added).getByRole("button", { name: "سطح المكتب — العربية" }));
    save();

    await waitFor(() => expect(replaceShopCustomSections).toHaveBeenCalledTimes(1));
    const blocks = replaceShopCustomSections.mock.calls[0]![0];
    expect(blocks[2]).toEqual(expect.objectContaining({
      type: "media",
      mediaSectionId: null,
      items: [expect.objectContaining({ arImagePath: "/uploads/changed-سطح المكتب — العربية.jpg" })]
    }));
  });

  it("removes a section from the list", async () => {
    openCustomTab();
    fireEvent.click(within(sectionItems()[0]!).getByRole("button", { name: "إزالة القسم" }));
    expect(sectionItems()).toHaveLength(1);
    save();

    await waitFor(() => expect(replaceShopCustomSections).toHaveBeenCalledTimes(1));
    expect(replaceShopCustomSections.mock.calls[0]![0]).toEqual([expect.objectContaining({ type: "media", mediaSectionId: 50 })]);
  });

  it("offers each category only once and never a deleted one", () => {
    openCustomTab();
    fireEvent.click(screen.getByRole("button", { name: "إضافة قسم منتجات" }));
    const picker = within(sectionItems()[2]!).getByLabelText("القسم");
    const values = within(picker).getAllByRole("option").map((option) => (option as HTMLOptionElement).value);
    expect(values).toEqual(["", "11", "12"]);
  });

  it("blocks saving a products section with no category chosen", async () => {
    openCustomTab();
    fireEvent.click(screen.getByRole("button", { name: "إضافة قسم منتجات" }));
    save();

    expect(replaceShopCustomSections).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), "اختاري قسمًا لكل قسم منتجات قبل الحفظ.");
    });
  });

  it("blocks saving a picture section with an image that has no picture", async () => {
    openCustomTab();
    fireEvent.click(screen.getByRole("button", { name: "إضافة قسم صور" }));
    fireEvent.click(within(sectionItems()[2]!).getByRole("button", { name: "أضيفي أول صورة" }));
    save();

    expect(replaceShopCustomSections).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error), "أضيفي صورة واحدة على الأقل وحددي الوجهة المطلوبة لكل عنصر قبل الحفظ.");
    });
  });

  it("keeps unsaved changes when store data refreshes", async () => {
    const view = render(createElement(ShopMediaPage));
    fireEvent.click(screen.getByRole("tab", { name: "الأقسام المخصصة" }));
    fireEvent.click(within(sectionItems()[0]!).getByRole("button", { name: "إزالة القسم" }));
    mockState = makeMockState();
    view.rerender(createElement(ShopMediaPage));
    expect(sectionItems()).toHaveLength(1);
  });

  it("shows the list read-only without the edit permission", () => {
    permissionKeys = ["shop_media.read"];
    openCustomTab();
    expect(sectionItems()).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "حفظ الأقسام" })).toBeNull();
    expect(screen.queryByRole("button", { name: "إضافة قسم منتجات" })).toBeNull();
    expect(screen.queryByRole("button", { name: "إزالة القسم" })).toBeNull();
  });
});
