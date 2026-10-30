import { render, screen, within } from "@testing-library/react";
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
  it("has no sign-up form, because nothing would receive the email", () => {
    render(<Footer lang="en" dict={getDict("en")} />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("links to the toy shop's pages, not the old beauty categories", () => {
    const { container } = render(<Footer lang="en" dict={getDict("en")} />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/en/shop", "/en/products", "/en/new", "/en/bestsellers", "/en/offers", "/en/collections"]));
    expect(hrefs.some((href) => href?.includes("/category/"))).toBe(false);
  });

  it("sends both app store badges to the app coming soon page", () => {
    render(<Footer lang="ar" dict={getDict("ar")} />);
    const dict = getDict("ar");

    expect(screen.getByRole("link", { name: new RegExp(dict.footer.appStore) })).toHaveAttribute("href", "/ar/get-app");
    expect(screen.getByRole("link", { name: new RegExp(dict.footer.googlePlay) })).toHaveAttribute("href", "/ar/get-app");
  });
});
