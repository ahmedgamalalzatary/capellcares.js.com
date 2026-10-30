import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en"
}));

import { Footer } from "@/components/layout/footer";

beforeAll(() => {
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  } as any;
});

describe("footer", () => {
  it("does not send customers to the old store's WhatsApp or map", () => {
    const { container } = render(<Footer lang="en" dict={getDict("en")} />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.filter((href) => /wa\.me|maps\.app|capella/i.test(href))).toEqual([]);
  });

  it("has no sign-up form, because nothing would receive the email", () => {
    render(<Footer lang="en" dict={getDict("en")} />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("links to the toy shop's pages, not the old beauty categories", () => {
    const { container } = render(<Footer lang="en" dict={getDict("en")} />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/en/shop", "/en/products", "/en/new", "/en/bestsellers", "/en/offers"]));
    expect(hrefs.some((href) => href?.includes("/category/"))).toBe(false);
  });

  it("has no Sets link and no app store badges", () => {
    const { container } = render(<Footer lang="en" dict={getDict("en")} />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/en/collections");
    expect(hrefs).not.toContain("/en/get-app");
  });

  it("shows the white logo", () => {
    render(<Footer lang="en" dict={getDict("en")} />);
    expect(screen.getByRole("img", { name: getDict("en").brand }).getAttribute("src")).toContain("logo-footer.png");
  });
});
