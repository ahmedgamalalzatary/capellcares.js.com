import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector({
    collections: [],
    categories: []
  })
}));

import CollectionsListPage from "@/app/collections/page";

describe("CollectionsListPage", () => {
  it("renders a clickable link to create a new collection", () => {
    render(createElement(CollectionsListPage));

    const link = screen.getByRole("link", { name: /مجموعة جديدة/ });
    expect(link).toHaveAttribute("href", "/collections/new");
  });
});
