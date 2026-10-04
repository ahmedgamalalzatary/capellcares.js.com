import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt, src, fill, sizes, priority, ...rest }: any) => {
    const resolvedSrc = typeof src === "string" ? src : src?.src;
    return createElement("img", {
      alt,
      src: resolvedSrc,
      "data-next-image": "true",
      "data-fill": fill ? "true" : "false",
      "data-priority": priority ? "true" : "false",
      sizes,
      ...rest
    });
  }
}));

// jsdom's matchMedia is unusable here, and a case that spies on it and calls
// mockRestore() can leave it without an implementation. Reinstall a complete stub
// before every case so later cases never see an undefined matchMedia.
function installMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(min-width: 640px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

installMatchMedia();
beforeEach(installMatchMedia);

afterEach(() => {
  cleanup();
});
