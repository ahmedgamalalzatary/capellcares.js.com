import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn()
}));

const push = vi.fn();
const upsertCategory = vi.fn().mockRejectedValue(Object.assign(new Error("API 409 /api/erp/categories"), {
  status: 409,
  body: { reason: "category-name-conflict" }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push
  })
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError
  }
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    upsertCategory
  })
}));

import { CategoryForm } from "@/components/forms/category-form";

describe("CategoryForm toast errors", () => {
  it("shows a toast when saving a category fails with a handled API error", async () => {
    render(createElement(CategoryForm, { mode: "new", categories: [] }));

    const [nameArInput, nameEnInput] = screen.getAllByRole("textbox");

    fireEvent.change(nameArInput, { target: { value: "العناية بالجسم" } });
    fireEvent.change(nameEnInput, { target: { value: "Body Care" } });
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
