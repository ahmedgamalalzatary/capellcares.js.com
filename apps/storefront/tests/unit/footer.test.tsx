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
  it("shows a logo for every way to pay the store accepts", () => {
    render(<Footer lang="en" dict={getDict("en")} />);

    const methods = screen.getByRole("list", { name: "Payment Methods" });
    const labels = within(methods).getAllByRole("listitem").map((item) => item.getAttribute("aria-label"));

    expect(labels).toEqual([
      "Visa",
      "Mastercard",
      "Meeza",
      "Cash on Delivery",
      "Vodafone Cash",
      "Orange Cash",
      "e& money",
      "WE Pay"
    ]);
  });

  it("sends both app store badges to the app coming soon page", () => {
    render(<Footer lang="ar" dict={getDict("ar")} />);
    const dict = getDict("ar");

    expect(screen.getByRole("link", { name: new RegExp(dict.footer.appStore) })).toHaveAttribute("href", "/ar/get-app");
    expect(screen.getByRole("link", { name: new RegExp(dict.footer.googlePlay) })).toHaveAttribute("href", "/ar/get-app");
  });
});
