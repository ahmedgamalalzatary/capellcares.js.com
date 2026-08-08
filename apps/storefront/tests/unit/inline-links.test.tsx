import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

import { renderInlineLinks } from "@/lib/inline-links";

const wrap = (text: string, lang: "en" | "ar" = "en") =>
  render(createElement("p", null, renderInlineLinks(text, lang)));

describe("renderInlineLinks", () => {
  it("leaves text with no markers untouched", () => {
    wrap("Please read this document carefully.");

    expect(screen.getByText("Please read this document carefully.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("resolves an internal target against the active locale", () => {
    wrap("contact us through the “[Help Center](/contact)” page");

    const link = screen.getByRole("link", { name: "Help Center" });
    expect(link).toHaveAttribute("href", "/en/contact");
    expect(link).not.toHaveAttribute("target");
  });

  it("keeps internal links inside the Arabic locale", () => {
    wrap("عبر صفحة “[مركز المساعدة](/contact)”", "ar");

    expect(screen.getByRole("link", { name: "مركز المساعدة" })).toHaveAttribute("href", "/ar/contact");
  });

  it("points a bare home target at the locale root, with no trailing slash", () => {
    wrap("listed on the website “[https://www.capellacares.com](/)”");

    expect(screen.getByRole("link", { name: "https://www.capellacares.com" })).toHaveAttribute("href", "/en");
  });

  it("opens third-party targets in a new tab, safely", () => {
    wrap("visit the [Network Advertising Initiative](https://thenai.org/) website.");

    const link = screen.getByRole("link", { name: "Network Advertising Initiative" });
    expect(link).toHaveAttribute("href", "https://thenai.org/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("handles several links in one paragraph and keeps the prose between them", () => {
    wrap("See the “[Privacy Policy](/privacy-policy)” and the “[Returns & Refunds](/returns-refunds)” page.");

    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/en/privacy-policy");
    expect(screen.getByRole("link", { name: "Returns & Refunds" })).toHaveAttribute("href", "/en/returns-refunds");
    expect(screen.getByText(/and the/)).toBeInTheDocument();
  });

  it("leaves square brackets that are not a link marker as literal text", () => {
    wrap("Orders over [600] EGP ship free.");

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Orders over [600] EGP ship free.")).toBeInTheDocument();
  });
});
