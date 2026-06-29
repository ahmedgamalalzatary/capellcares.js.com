import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ItemTags } from "@/components/ui/item-tags";

describe("ItemTags", () => {
  it("keeps float links clickable", () => {
    render(createElement(ItemTags, {
      variant: "float",
      tags: [{ kind: "offer", label: "Offer", href: "/en/offers/save-more" }]
    }));

    expect(screen.getByRole("link", { name: "Offer" }).className).not.toContain("pointer-events-none");
  });

  it("uses stable unique keys when labels collide", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(createElement(ItemTags, {
      variant: "badge",
      tags: [
        { kind: "offer", label: "Sale", href: "/en/offers/a" },
        { kind: "offer", label: "Sale", href: "/en/offers/b" }
      ]
    }));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
