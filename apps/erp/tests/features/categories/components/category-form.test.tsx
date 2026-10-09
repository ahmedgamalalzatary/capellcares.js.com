import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
const push = vi.fn();
const upsertCategory = vi.fn().mockResolvedValue(undefined);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push
  })
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: vi.fn()
  }
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    upsertCategory
  })
}));

import { CategoryForm } from "@/features/categories/components/category-form";

afterEach(() => {
  cleanup();
  upsertCategory.mockReset();
  upsertCategory.mockResolvedValue(undefined);
  toastError.mockClear();
  push.mockClear();
});

const categories = [
  { id: 1, parentId: null, slug: "hair-care", name: { ar: "العناية بالشعر", en: "Hair Care" }, isLeaf: false, deletedAt: null },
  { id: 2, parentId: 1, slug: "hair-oils", name: { ar: "زيوت الشعر", en: "Hair Oils" }, isLeaf: false, deletedAt: null },
  { id: 3, parentId: 2, slug: "dry-hair", name: { ar: "شعر جاف", en: "Dry Hair" }, isLeaf: true, deletedAt: null }
];

const fillNames = () => {
  const [nameArInput, nameEnInput] = screen.getAllByRole("textbox");
  fireEvent.change(nameArInput!, { target: { value: "قسم جديد" } });
  fireEvent.change(nameEnInput!, { target: { value: "New Category" } });
};

describe("CategoryForm", () => {
  it("shows the category tree as indented options and previews the selected path", () => {
    render(createElement(CategoryForm, { mode: "new", categories }));

    expect(screen.getByRole("option", { name: "العناية بالشعر" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "— زيوت الشعر" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "— — شعر جاف" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "3" } });

    expect(screen.getByTestId("category-path")).toHaveTextContent("شعر جاف");
  });

  it("offers the image slot only once the category is a direct child of a root", () => {
    render(createElement(CategoryForm, { mode: "new", categories }));

    fillNames();
    fireEvent.click(screen.getByRole("button", { name: /التالي/ }));

    expect(screen.getByText("صورة القسم متاحة فقط للأقسام الفرعية المباشرة تحت قسم رئيسي.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /السابق/ }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /التالي/ }));

    expect(screen.queryByText("صورة القسم متاحة فقط للأقسام الفرعية المباشرة تحت قسم رئيسي.")).not.toBeInTheDocument();
    expect(screen.getByText("رفع صورة")).toBeInTheDocument();
  });
});

describe("CategoryForm toast errors", () => {
  it("shows a toast when saving a category fails with a handled API error", async () => {
    upsertCategory.mockRejectedValue(Object.assign(new Error("API 409 /api/erp/categories"), {
      status: 409,
      body: { reason: "category-name-conflict" }
    }));

    render(createElement(CategoryForm, { mode: "new", categories: [] }));

    const [nameArInput, nameEnInput] = screen.getAllByRole("textbox");

    fireEvent.change(nameArInput!, { target: { value: "العناية بالجسم" } });
    fireEvent.change(nameEnInput!, { target: { value: "Body Care" } });
    fireEvent.click(screen.getByRole("button", { name: /التالي/ }));
    fireEvent.click(screen.getByRole("button", { name: "إنشاء القسم" }));

    await waitFor(() => {
      expect(upsertCategory).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("اسم القسم مستخدم بالفعل داخل القسم الأب الحالي. غيّري الاسم أو اختاري قسمًا أبًا مختلفًا.");
    });

    expect(push).not.toHaveBeenCalled();
  });
});
