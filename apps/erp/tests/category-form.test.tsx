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
});
