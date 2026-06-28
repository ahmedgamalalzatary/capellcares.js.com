import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

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

Object.defineProperty(window, "matchMedia", {
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

afterEach(() => {
  cleanup();
});
