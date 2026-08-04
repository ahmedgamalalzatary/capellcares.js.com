import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/lib/api/client", () => ({
  fetchProducts: vi.fn(async () => []),
  fetchCategories: vi.fn(async () => []),
  fetchOffers: vi.fn(async () => []),
  fetchCollections: vi.fn(async () => [])
}));

import { fetchProducts } from "@/lib/api/client";
import { AskCapellaOverlay } from "@/components/ask-capella/ask-capella-overlay";

// jsdom has no layout, so the transcript's auto-scroll is a no-op here.
Element.prototype.scrollIntoView = vi.fn();

function renderOverlay() {
  render(createElement(AskCapellaOverlay, { lang: "en", onClose: vi.fn() }));
  return screen.getByPlaceholderText("Type a message…") as HTMLInputElement;
}

describe("AskCapellaOverlay", () => {
  it("puts focus back in the field after a question is answered", async () => {
    const input = renderOverlay();
    input.focus();

    fireEvent.change(input, { target: { value: "hair loss" } });
    fireEvent.submit(input.closest("form")!);
    // The browser drops focus when the field is disabled mid-send, so the next
    // question could not be typed without clicking the field again.
    input.blur();

    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("waits for the answer before taking focus back", async () => {
    let releaseAnswer!: (products: never[]) => void;
    vi.mocked(fetchProducts).mockImplementationOnce(
      () => new Promise((resolve) => { releaseAnswer = resolve; })
    );

    const input = renderOverlay();
    const send = input.closest("form")!.querySelector("button")!;

    fireEvent.change(input, { target: { value: "hair loss" } });
    // Tapping send is what moves focus off the field on a touch device. Pulling
    // it straight back would raise the keyboard over the answer being awaited.
    send.focus();
    fireEvent.click(send);

    await screen.findByText("hair loss");
    expect(document.activeElement).not.toBe(input);

    releaseAnswer([]);
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("keeps the field usable for a second question without another click", async () => {
    const input = renderOverlay();
    input.focus();

    fireEvent.change(input, { target: { value: "hair loss" } });
    fireEvent.submit(input.closest("form")!);
    input.blur();
    await waitFor(() => expect(document.activeElement).toBe(input));

    fireEvent.change(input, { target: { value: "dry skin" } });

    expect(input).toHaveValue("dry skin");
    expect(input).not.toBeDisabled();
  });

  it("leaves focus alone when the overlay first opens on a touch device", () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }) as MediaQueryList);

    const input = renderOverlay();

    expect(document.activeElement).not.toBe(input);
    matchMedia.mockRestore();
  });
});
