import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push
  })
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    upsertCategory: vi.fn()
  })
}));

vi.mock("@/components/forms/image-upload", () => ({
  ImageUpload: ({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) =>
    createElement("div", null, [
      createElement("div", { key: "label" }, "IMAGE_UPLOAD"),
      createElement("button", { key: "set", type: "button", onClick: () => onChange("/uploads/category.png") }, "set image"),
      createElement("div", { key: "value" }, value ?? "")
    ])
}));

import { CategoryForm } from "@/components/forms/category-form";

const categories = [
  { id: 1, parentId: null, slug: "hair-care", name: { ar: "العناية بالشعر", en: "Hair Care" }, isLeaf: false, deletedAt: null },
  { id: 2, parentId: 1, slug: "hair-oils", name: { ar: "زيوت الشعر", en: "Hair Oils" }, isLeaf: false, deletedAt: null },
  { id: 3, parentId: 2, slug: "dry-hair", name: { ar: "شعر جاف", en: "Dry Hair" }, isLeaf: true, deletedAt: null }
];

describe("CategoryForm", () => {
  it("shows parent options as a hierarchical dropdown with a visible selected path", () => {
    render(createElement(CategoryForm, { mode: "new", categories }));

    expect(screen.getByRole("option", { name: "العناية بالشعر" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "↳ زيوت الشعر (العناية بالشعر)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "↳ ↳ شعر جاف (العناية بالشعر › زيوت الشعر)" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "3" } });

    expect(screen.getByText("المسار: العناية بالشعر › زيوت الشعر › شعر جاف")).toBeInTheDocument();
  });

  it("shows category image upload when the selected category depth is 0 or 1", () => {
    render(createElement(CategoryForm, { mode: "new", categories }));
    const parentSelect = screen.getAllByRole("combobox").at(-1)!;

    expect(screen.getByText("IMAGE_UPLOAD")).toBeInTheDocument();

    fireEvent.change(parentSelect, { target: { value: "1" } });
    expect(screen.getByText("IMAGE_UPLOAD")).toBeInTheDocument();

    fireEvent.change(parentSelect, { target: { value: "2" } });
    expect(screen.queryByText("IMAGE_UPLOAD")).not.toBeInTheDocument();
  });
});
