import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

import { RelatedItems } from "@/components/products/related-items";

describe("RelatedItems", () => {
  const items = [
    {
      type: "product" as const,
      id: 1,
      slug: "serum",
      name: { ar: "سيروم", en: "Serum" },
      imagePath: "/uploads/serum.jpg",
      price: 100
    }
  ];

  it("keeps the selected one-column and two-column layouts across breakpoints", () => {
    render(createElement(RelatedItems, { items, lang: "en", title: "Related" }));

    const grid = screen.getByTestId("related-items").querySelector(".grid.gap-4") as HTMLElement;
    expect(grid.className).toContain("grid-cols-2");
    expect(grid.className).toContain("md:grid-cols-3");
    expect(grid.className).toContain("lg:grid-cols-4");

    fireEvent.click(screen.getByRole("button", { name: /1 per row/i }));

    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("md:grid-cols-2");
    expect(grid.className).toContain("lg:grid-cols-3");
  });
});
