import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ItemTags } from "@/components/ui/item-tags";

describe("ItemTags", () => {
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
