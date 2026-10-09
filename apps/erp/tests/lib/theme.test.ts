import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_DARK_QUERY, THEME_STORAGE_KEY, themeBootScript } from "@/lib/theme-script";
import { useThemePreference } from "@/lib/theme";

function stubColorScheme(dark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === THEME_DARK_QUERY ? dark : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  }));
}

describe("ERP theme default", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to light when nothing is stored, even if the OS prefers dark", () => {
    stubColorScheme(true);

    renderHook(() => useThemePreference());

    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("paints light on first boot when nothing is stored", () => {
    stubColorScheme(true);

    window.eval(themeBootScript);

    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("persists an explicit system preference", () => {
    stubColorScheme(true);
    const { result } = renderHook(() => useThemePreference());

    act(() => {
      result.current.setPreference("system");
    });

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });
});
