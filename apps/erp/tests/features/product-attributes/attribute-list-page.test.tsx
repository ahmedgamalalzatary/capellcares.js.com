import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertProductAttribute = vi.fn().mockResolvedValue(undefined);
const deleteProductAttribute = vi.fn().mockResolvedValue(undefined);
const reorderProductAttributes = vi.fn().mockResolvedValue(undefined);

const state = {
  loaded: true,
  brands: [
    { id: 1, slug: "lego", name: { ar: "ليجو", en: "LEGO" }, imagePath: "/uploads/lego.png" },
    { id: 2, slug: "barbie", name: { ar: "باربي", en: "Barbie" }, imagePath: null }
  ],
  characters: [],
  ageGroups: [{ id: 5, slug: "0-2", name: { ar: "٠-٢", en: "0-2" } }],
  suppliers: [{ id: 9, name: "Supplier 1" }]
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/brands",
  useSearchParams: () => new URLSearchParams()
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({ upsertProductAttribute, deleteProductAttribute, reorderProductAttributes }),
  useStore: (selector: (s: typeof state) => unknown) => selector(state)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({ user: { role: "admin", permissionKeys: ["products.read", "products.update"] } })
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ title, actions, children }: any) => (
    <div>
      <h1>{title}</h1>
      {actions}
      {children}
    </div>
  )
}));

vi.mock("@/components/forms/single-image-field", () => ({
  SingleImageField: ({ label }: any) => <div>{label}</div>
}));

import { AttributeListPage } from "@/features/product-attributes/components/attribute-list-page";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function openEditor(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("AttributeListPage", () => {
  it("lists brands with both names", () => {
    render(<AttributeListPage kind="brands" />);
    expect(screen.getByRole("heading", { name: "الماركات" })).toBeInTheDocument();
    expect(screen.getByText("ليجو")).toBeInTheDocument();
    expect(screen.getByText("LEGO")).toBeInTheDocument();
  });

  it("creates a brand with Arabic and English names and offers an image", async () => {
    render(<AttributeListPage kind="brands" />);
    openEditor("ماركة جديدة");
    expect(screen.getByText("صورة الماركة")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/الاسم بالعربية/), { target: { value: "فيشر" } });
    fireEvent.change(screen.getByLabelText(/الاسم بالإنجليزية/), { target: { value: "Fisher" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(upsertProductAttribute).toHaveBeenCalledWith("brands", {
      name: { ar: "فيشر", en: "Fisher" },
      imagePath: null
    }));
  });

  it("does not save without both names", () => {
    render(<AttributeListPage kind="brands" />);
    openEditor("ماركة جديدة");
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(upsertProductAttribute).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("age groups have no image", () => {
    render(<AttributeListPage kind="ageGroups" />);
    openEditor("فئة عمرية جديدة");
    expect(screen.queryByText(/صورة/)).not.toBeInTheDocument();
  });

  it("suppliers need only one name", async () => {
    render(<AttributeListPage kind="suppliers" />);
    expect(screen.getByText("Supplier 1")).toBeInTheDocument();
    openEditor("مورد جديد");
    expect(screen.queryByLabelText(/الاسم بالإنجليزية/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("اسم المورد"), { target: { value: "Supplier 2" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(upsertProductAttribute).toHaveBeenCalledWith("suppliers", { name: "Supplier 2" }));
  });

  it("shows an empty message when the list has nothing", () => {
    render(<AttributeListPage kind="characters" />);
    expect(screen.getByText("لا توجد شخصيات بعد")).toBeInTheDocument();
  });
});
