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
  it("does not send customers to the old store's pages or map", () => {
    const { container } = render(<Footer lang="en" dict={getDict("en")} />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.filter((href) => /maps\.app|capella|201034668590/i.test(href))).toEqual([]);
  });

  it("has a Social column with Falta's five accounts, and sends Customer Service to the same WhatsApp", () => {
    const { container } = render(<Footer lang="en" dict={getDict("en")} />);
    const hrefOf = (name: string) => screen.getByRole("link", { name }).getAttribute("href");
    expect(screen.getByRole("heading", { name: "Social" })).toBeInTheDocument();
    expect(hrefOf("Facebook")).toBe("https://www.facebook.com/share/1DVxmjxPFQ/?mibextid=wwXIfr");
    expect(hrefOf("Instagram")).toBe("https://www.instagram.com/faltatoy?exln=eGNqYnhoMzNmeWJh&utm_source=qr");
    expect(hrefOf("TikTok")).toBe("https://www.tiktok.com/@faltatoy?_r=1&_t=ZS-9B0eYWrRqcP");
    expect(hrefOf("YouTube")).toBe("https://youtube.com/@faltatoy9081?si=EkpBtHEp0BoVO_zH");
    expect(hrefOf("WhatsApp")).toBe("https://wa.me/96566343797");
    expect(hrefOf("Customer Service")).toBe("https://wa.me/96566343797");
    expect(container.textContent).not.toMatch(/capella/i);
  });

  it("shows the cash on delivery logo, without any free delivery wording", () => {
    for (const lang of ["en", "ar"] as const) {
      const dict = getDict(lang);
      const { container, unmount } = render(<Footer lang={lang} dict={dict} />);
      expect(screen.getByRole("img", { name: dict.footer.paymentMethods })).toBeInTheDocument();
      expect(container.textContent).not.toMatch(/free delivery|توصيل مجاني|التوصيل مجاني/i);
      unmount();
    }
  });

  it("credits bit Technology", () => {
    render(<Footer lang="en" dict={getDict("en")} />);
    expect(screen.getByText(/bit Technology/)).toBeInTheDocument();
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
