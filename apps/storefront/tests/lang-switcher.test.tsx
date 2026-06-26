import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { LangSwitcher } from "@/components/header/LangSwitcher";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/shop",
  useSearchParams: () => new URLSearchParams("category=slides&page=2"),
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() })
}));

describe("LangSwitcher", () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
    window.location.hash = "";
  });

  it("preserves the current query string and hash while swapping the locale prefix", () => {
    window.location.hash = "#reviews";

    render(
      <LocaleProvider lang="en">
        <LangSwitcher />
      </LocaleProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "العربية" }));

    expect(push).toHaveBeenCalledWith("/ar/shop?category=slides&page=2#reviews");
  });
});
