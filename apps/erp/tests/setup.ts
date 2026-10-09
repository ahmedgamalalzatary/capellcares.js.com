import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL only auto-registers cleanup when the test globals exist; this project runs Vitest without `globals: true`, so every render() would stay mounted in document.body and a later case would see duplicate test ids and label associations from earlier cases.
// Unmount after every case.
afterEach(() => {
  cleanup();
});

// jsdom ships no matchMedia; components that read a media query (AdminListHeader, the theme hook) would throw without it.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

// jsdom implements neither; page code calls scrollTo on step changes.
window.scrollTo = (() => {}) as unknown as typeof window.scrollTo;

// Radix primitives (menus, popovers, switches) need these browser APIs that jsdom lacks.
if (typeof window.ResizeObserver !== "function") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof window.ResizeObserver;
}
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}
if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture !== "function") {
  Element.prototype.releasePointerCapture = () => {};
}
