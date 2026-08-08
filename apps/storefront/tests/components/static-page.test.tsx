import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

import { StaticPage } from "@/components/pages/static-page";

describe("StaticPage", () => {
  it("turns the marked phrases in paragraphs and list items into real links", () => {
    render(createElement(StaticPage, {
      lang: "en",
      dict: { common: { breadcrumbHome: "Home" } },
      content: {
        title: "Terms",
        blocks: [
          { p: "Contact the “[Help Center](/contact)” page." },
          { ul: ["Visit [aboutcookies](https://www.aboutcookies.com/) to learn more."] }
        ]
      }
    }));

    expect(screen.getByRole("link", { name: "Help Center" })).toHaveAttribute("href", "/en/contact");
    expect(screen.getByRole("link", { name: "aboutcookies" })).toHaveAttribute("target", "_blank");
  });

  it("links the real legal copy shipped in the dictionary", () => {
    const dict = getDict("en");

    render(createElement(StaticPage, {
      lang: "en",
      dict,
      content: dict.pages.termsSale
    }));

    // The phrases the source document styles as links.
    expect(screen.getAllByRole("link", { name: "Customer Service" })[0]).toHaveAttribute("href", "/en/contact");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/en/privacy-policy");
    expect(screen.getByRole("link", { name: "Shipping and Handling" })).toHaveAttribute("href", "/en/shipping-handling");
    expect(screen.getByRole("link", { name: "Returns & Refunds" })).toHaveAttribute("href", "/en/returns-refunds");
    expect(screen.getAllByRole("link", { name: "Help Center" })[0]).toHaveAttribute("href", "/en/contact");
  });

  it("links the Arabic legal copy to the same pages", () => {
    const dict = getDict("ar");

    render(createElement(StaticPage, {
      lang: "ar",
      dict,
      content: dict.pages.termsSale
    }));

    expect(screen.getAllByRole("link", { name: "مركز المساعدة" })[0]).toHaveAttribute("href", "/ar/contact");
    expect(screen.getByRole("link", { name: "سياسة الخصوصية" })).toHaveAttribute("href", "/ar/privacy-policy");
  });

  it("never leaves a raw link marker visible to the reader", () => {
    const { container } = render(createElement(StaticPage, {
      lang: "en",
      dict: getDict("en"),
      content: getDict("en").pages.privacy
    }));

    expect(container.textContent).not.toMatch(/\]\(/);
    // The browser's own "Help" page is not our Help Center — it must stay plain text.
    expect(screen.queryByRole("link", { name: "Help" })).toBeNull();
  });
});
