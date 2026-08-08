import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let pathname = "/en/products";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname
}));

import { useLanguageSwitch } from "@/hooks/use-language-switch";

function Probe({ lang }: { lang: "en" | "ar" }) {
  const { switchLang } = useLanguageSwitch(lang);
  return createElement("button", { onClick: switchLang }, "switch");
}

function switchFrom(lang: "en" | "ar", path: string, search = "") {
  pathname = path;
  window.history.replaceState({}, "", `${path}${search}`);
  render(createElement(Probe, { lang }));
  fireEvent.click(screen.getByRole("button", { name: "switch" }));
  return push.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  push.mockReset();
});

describe("useLanguageSwitch", () => {
  it("swaps the locale segment while staying on the same page", () => {
    expect(switchFrom("en", "/en/products")).toBe("/ar/products");
  });

  it("switches back the other way", () => {
    expect(switchFrom("ar", "/ar/collections/glow")).toBe("/en/collections/glow");
  });

  it("keeps the query string so filters and searches survive the switch", () => {
    expect(switchFrom("en", "/en/products", "?q=lotion")).toBe("/ar/products?q=lotion");
  });

  it("maps the locale home to the other locale home", () => {
    expect(switchFrom("en", "/en")).toBe("/ar");
  });
});
