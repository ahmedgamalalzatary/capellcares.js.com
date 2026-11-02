import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertProductAttribute = vi.fn().mockResolvedValue(undefined);
const deleteProductAttribute = vi.fn().mockResolvedValue(undefined);
const reorderProductAttributes = vi.fn().mockResolvedValue(undefined);

const state = {
  loaded: true,
  ageGroups: [{ id: 5, slug: "0-2", name: { ar: "٠-٢", en: "0-2" }, imagePath: "/uploads/age.png" }],
  brands: [{ id: 1, slug: "lego", name: { ar: "ليجو", en: "LEGO" }, imagePath: null }],
  genders: [],
  suppliers: [{ id: 9, name: "Supplier 1" }]
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/age-groups",
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
  SingleImageField: ({ label, onChange }: any) => <button type="button" onClick={() => onChange("/uploads/new.png")}>{label}</button>
}));
vi.mock("@/components/forms/lang-image-field", () => ({
  LangImageField: ({ title, onChange, error }: any) => (
    <div>
      <button type="button" onClick={() => onChange("/uploads/new.png")}>{title}</button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}));

import { AttributeListPage } from "@/features/product-attributes/components/attribute-list-page";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function openEditor(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("AttributeListPage", () => {
  it("lists age groups with both names", () => {
    render(<AttributeListPage kind="ageGroups" />);
    expect(screen.getByRole("heading", { name: "الفئات العمرية" })).toBeInTheDocument();
    expect(screen.getByText("٠-٢")).toBeInTheDocument();
    expect(screen.getByText("0-2")).toBeInTheDocument();
  });

  it("does not save an age group without a photo", () => {
    render(<AttributeListPage kind="ageGroups" />);
    openEditor("فئة عمرية جديدة");
    fireEvent.change(screen.getByLabelText(/الاسم بالعربية/), { target: { value: "٣-٥" } });
    fireEvent.change(screen.getByLabelText(/الاسم بالإنجليزية/), { target: { value: "3-5" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(upsertProductAttribute).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("أضيفي صورة الفئة العمرية");
  });

  it("saves an age group with both names and its photo", async () => {
    render(<AttributeListPage kind="ageGroups" />);
    openEditor("فئة عمرية جديدة");
    fireEvent.change(screen.getByLabelText(/الاسم بالعربية/), { target: { value: "٣-٥" } });
    fireEvent.change(screen.getByLabelText(/الاسم بالإنجليزية/), { target: { value: "3-5" } });
    fireEvent.click(screen.getByRole("button", { name: "صورة الفئة العمرية" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(upsertProductAttribute).toHaveBeenCalledWith("ageGroups", {
      name: { ar: "٣-٥", en: "3-5" },
      imagePath: "/uploads/new.png"
    }));
  });

  it("does not save without both names", () => {
    render(<AttributeListPage kind="ageGroups" />);
    openEditor("فئة عمرية جديدة");
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(upsertProductAttribute).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("saves a gender with both names and both photos, and refuses one missing a photo", async () => {
    render(<AttributeListPage kind="genders" />);
    expect(screen.getByText("لا توجد أنواع بعد")).toBeInTheDocument();
    openEditor("نوع جديد");
    fireEvent.change(screen.getByLabelText(/الاسم بالعربية/), { target: { value: "بنات" } });
    fireEvent.change(screen.getByLabelText(/الاسم بالإنجليزية/), { target: { value: "Girls" } });
    fireEvent.click(screen.getByRole("button", { name: "صورة النوع بالإنجليزية" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(upsertProductAttribute).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("أضيفي صورة النوع بالعربية");

    fireEvent.click(screen.getByRole("button", { name: "صورة النوع بالعربية" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(upsertProductAttribute).toHaveBeenCalledWith("genders", {
      name: { ar: "بنات", en: "Girls" },
      imagePath: "/uploads/new.png",
      arImagePath: "/uploads/new.png"
    }));
  });

  it("saves a brand with both names, with its picture being optional", async () => {
    render(<AttributeListPage kind="brands" />);
    expect(screen.getByText("LEGO")).toBeInTheDocument();
    openEditor("ماركة جديدة");
    fireEvent.change(screen.getByLabelText(/الاسم بالعربية/), { target: { value: "باربي" } });
    fireEvent.change(screen.getByLabelText(/الاسم بالإنجليزية/), { target: { value: "Barbie" } });
    expect(screen.getByRole("button", { name: "صورة الماركة" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(upsertProductAttribute).toHaveBeenCalledWith("brands", {
      name: { ar: "باربي", en: "Barbie" },
      imagePath: null
    }));
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
    const stored = state.suppliers;
    state.suppliers = [];
    render(<AttributeListPage kind="suppliers" />);
    expect(screen.getByText("لا يوجد موردون بعد")).toBeInTheDocument();
    state.suppliers = stored;
  });
});
