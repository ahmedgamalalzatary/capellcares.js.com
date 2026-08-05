import { render, fireEvent, act } from "@testing-library/react";
import { createElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShopMediaSection } from "@capella/shared";

vi.mock("next/image", () => ({
  default: ({ alt, src, fill, sizes, priority, ...rest }: any) =>
    createElement("img", {
      alt,
      src: typeof src === "string" ? src : src?.src,
      "data-next-image": "true",
      "data-fill": fill ? "true" : "false",
      "data-priority": priority ? "true" : "false",
      sizes,
      ...rest
    })
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

import { ShopMediaStrip } from "@/components/shop/shop-media-strip";

function getDesktopStrip(container: HTMLElement) {
  const strip = container.querySelector('[data-viewport="desktop"]');
  if (!(strip instanceof HTMLElement)) {
    throw new Error("Expected desktop strip to render");
  }
  return strip;
}

function mockViewport(isDesktop: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(min-width: 640px)" ? isDesktop : false,
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

function getDesktopCarousel(container: HTMLElement) {
  const carousel = getDesktopStrip(container).querySelector('[role="group"]');
  if (!(carousel instanceof HTMLElement)) {
    throw new Error("Expected desktop carousel to render");
  }
  return carousel;
}

function makeSection(itemCount: number): ShopMediaSection {
  return {
    id: 1,
    slot: 1,
    status: "active",
    items: Array.from({ length: itemCount }, (_, i) => ({
      id: i + 1,
      arImagePath: `http://localhost:4000/uploads/img-${i + 1}.jpg`,
      arMobileImagePath: `http://localhost:4000/uploads/mobile-img-${i + 1}.jpg`,
      enImagePath: `http://localhost:4000/uploads/img-${i + 1}.jpg`,
      enMobileImagePath: `http://localhost:4000/uploads/mobile-img-${i + 1}.jpg`,
      targetType: "collections" as const,
      targetId: null,
      targetSlug: null,
      sortOrder: i + 1
    }))
  };
}

describe("ShopMediaStrip carousel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockViewport(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a single image without carousel controls", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(1)} label="Media" />);
    const desktopStrip = getDesktopStrip(container);

    expect(desktopStrip.querySelector('[aria-label="Media 1"]')).not.toBeNull();
    expect(desktopStrip.querySelector('[aria-label="Next slide"]')).toBeNull();
    expect(desktopStrip.querySelector('[aria-label^="Go to slide"]')).toBeNull();
  });

  it("renders the desktop viewport image in the desktop strip", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(1)} label="Media" />);

    const image = getDesktopStrip(container).querySelector("img");
    expect(image).toHaveAttribute("src", "http://localhost:4000/uploads/img-1.jpg");
  });

  it("selects the desktop image for the requested language", () => {
    const section = makeSection(1);
    Object.assign(section.items[0]!, {
      arImagePath: "http://localhost:4000/uploads/ar-desktop.jpg",
      arMobileImagePath: "http://localhost:4000/uploads/ar-mobile.jpg",
      enImagePath: "http://localhost:4000/uploads/en-desktop.jpg",
      enMobileImagePath: "http://localhost:4000/uploads/en-mobile.jpg"
    });

    const { container, rerender } = render(<ShopMediaStrip lang="ar" section={section} label="Media" />);
    expect(getDesktopStrip(container).querySelector("img"))
      .toHaveAttribute("src", "http://localhost:4000/uploads/ar-desktop.jpg");

    rerender(<ShopMediaStrip lang="en" section={section} label="Media" />);
    expect(getDesktopStrip(container).querySelector("img"))
      .toHaveAttribute("src", "http://localhost:4000/uploads/en-desktop.jpg");
  });

  it("falls back to the other language for a missing localized viewport image", () => {
    const section = makeSection(1);
    Object.assign(section.items[0]!, {
      arImagePath: "http://localhost:4000/uploads/ar-desktop.jpg",
      enImagePath: null
    });

    const { container } = render(<ShopMediaStrip lang="en" section={section} label="Media" />);
    expect(getDesktopStrip(container).querySelector("img"))
      .toHaveAttribute("src", "http://localhost:4000/uploads/ar-desktop.jpg");

    Object.assign(section.items[0]!, {
      arImagePath: null,
      enImagePath: "http://localhost:4000/uploads/en-desktop.jpg"
    });
    const { container: arabicContainer } = render(<ShopMediaStrip lang="ar" section={section} label="Media" />);
    expect(getDesktopStrip(arabicContainer).querySelector("img"))
      .toHaveAttribute("src", "http://localhost:4000/uploads/en-desktop.jpg");
  });

  it("falls back between Arabic and English mobile images in both directions", () => {
    mockViewport(false);
    const section = makeSection(1);
    Object.assign(section.items[0]!, {
      arMobileImagePath: null,
      enMobileImagePath: "http://localhost:4000/uploads/en-mobile.jpg"
    });

    const { container, rerender } = render(<ShopMediaStrip lang="ar" section={section} label="Media" />);
    expect(container.querySelector('[data-viewport="mobile"] img'))
      .toHaveAttribute("src", "http://localhost:4000/uploads/en-mobile.jpg");

    Object.assign(section.items[0]!, {
      arMobileImagePath: "http://localhost:4000/uploads/ar-mobile.jpg",
      enMobileImagePath: null
    });
    rerender(<ShopMediaStrip lang="en" section={section} label="Media" />);
    expect(container.querySelector('[data-viewport="mobile"] img'))
      .toHaveAttribute("src", "http://localhost:4000/uploads/ar-mobile.jpg");
  });

  it("includes the category id in category target links", () => {
    const section = makeSection(1);
    section.items[0] = {
      ...section.items[0],
      targetType: "category",
      targetId: 2,
      targetSlug: "body-lotion"
    };

    const { container } = render(<ShopMediaStrip lang="en" section={section} label="Media" />);

    expect(getDesktopStrip(container).querySelector('[aria-label="Media 1"]'))
      .toHaveAttribute("href", "/en/category/body-lotion?categoryId=2");
  });

  it("falls back to the home page when a target no longer resolves", () => {
    const section = makeSection(1);
    section.items[0] = {
      ...section.items[0],
      targetType: "product",
      targetId: 7,
      targetSlug: null
    };

    const { container } = render(<ShopMediaStrip lang="en" section={section} label="Media" />);

    expect(getDesktopStrip(container).querySelector('[aria-label="Media 1"]'))
      .toHaveAttribute("href", "/en");
  });

  it("keeps showing a banner whose target was deleted instead of dropping the slide", () => {
    const section = makeSection(3);
    section.items[1] = {
      ...section.items[1],
      targetType: "collection",
      targetId: 4,
      targetSlug: null
    };

    const { container } = render(<ShopMediaStrip lang="ar" section={section} label="Media" />);
    const desktopStrip = getDesktopStrip(container);

    expect(desktopStrip.querySelector('[aria-label="Media 2"]')).not.toBeNull();
    expect(desktopStrip.querySelector('[aria-label="Media 2"]')).toHaveAttribute("href", "/ar");
  });

  it("mounts only one responsive strip instead of separate desktop and mobile strips", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(1)} label="Media" />);

    expect(container.querySelectorAll("[data-viewport]")).toHaveLength(1);
  });

  it("hydrates a mobile viewport without changing the initial server tree", async () => {
    const section = makeSection(1);
    const browserWindow = globalThis.window;
    vi.stubGlobal("window", undefined);
    const html = renderToString(<ShopMediaStrip lang="en" section={section} label="Media" />);
    vi.stubGlobal("window", browserWindow);
    mockViewport(false);

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: Root | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(container, <ShopMediaStrip lang="en" section={section} label="Media" />);
      });

      const errors = consoleError.mock.calls.flat().map(String).join("\n");
      expect(errors).not.toMatch(/hydration|didn't match/i);
      expect(container.querySelector('[data-viewport="mobile"]')).not.toBeNull();
    } finally {
      await act(async () => root?.unmount());
      consoleError.mockRestore();
      container.remove();
      vi.unstubAllGlobals();
    }
  });

  it("uses the mobile image source when the viewport is below the desktop breakpoint", () => {
    mockViewport(false);

    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(1)} label="Media" />);

    const strip = container.querySelector('[data-viewport="mobile"]');
    expect(strip?.querySelector("img")).toHaveAttribute("src", "http://localhost:4000/uploads/mobile-img-1.jpg");
  });

  it("renders strip images through next/image with responsive sizing", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(1)} label="Media" />);

    const image = getDesktopStrip(container).querySelector("img");
    expect(image).toHaveAttribute("data-next-image", "true");
    expect(image).toHaveAttribute("sizes");
  });

  it("skips items without desktop images in the desktop strip", () => {
    const section = makeSection(3);
    section.items[1] = {
      ...section.items[1],
      arImagePath: null,
      enImagePath: null,
      arMobileImagePath: "http://localhost:4000/uploads/mobile-only.jpg",
      enMobileImagePath: "http://localhost:4000/uploads/mobile-only.jpg"
    };

    const { container } = render(<ShopMediaStrip lang="en" section={section} label="Media" />);

    const desktopStrip = getDesktopStrip(container);
    expect(desktopStrip.querySelectorAll("[data-slide]")).toHaveLength(4);
    expect(desktopStrip.querySelector('[aria-label="Media 3"]')).toBeNull();
  });

  it("hides the desktop strip when no desktop images are available", () => {
    const section = makeSection(2);
    section.items = section.items.map((item) => ({
      ...item,
      arImagePath: null,
      enImagePath: null,
      arMobileImagePath: `http://localhost:4000/uploads/mobile-${item.id}.jpg`,
      enMobileImagePath: `http://localhost:4000/uploads/mobile-${item.id}.jpg`
    }));

    const { container } = render(<ShopMediaStrip lang="en" section={section} label="Media" />);
    expect(container.querySelector('[data-viewport="desktop"]')).toBeNull();
  });

  it("renders dots and arrows when there are multiple images", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const desktopStrip = getDesktopStrip(container);

    expect(desktopStrip.querySelector('[aria-label="Previous slide"]')).not.toBeNull();
    expect(desktopStrip.querySelector('[aria-label="Next slide"]')).not.toBeNull();
    expect(desktopStrip.querySelector('[aria-label^="Go to slide"]')).not.toBeNull();
  });

  it("auto-advances to the next slide every 5 seconds", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const carousel = getDesktopCarousel(container);

    expect(carousel).toHaveAttribute("data-active-index", "0");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(carousel).toHaveAttribute("data-active-index", "1");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(carousel).toHaveAttribute("data-active-index", "2");
  });

  it("pauses autoplay on hover", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const carousel = getDesktopCarousel(container);

    fireEvent.mouseEnter(carousel);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(carousel).toHaveAttribute("data-active-index", "0");

    fireEvent.mouseLeave(carousel);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(carousel).toHaveAttribute("data-active-index", "1");
  });

  it("steps to the next slide when the next arrow is clicked", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const desktopStrip = getDesktopStrip(container);
    const carousel = getDesktopCarousel(container);

    fireEvent.click(desktopStrip.querySelector('[aria-label="Next slide"]')!);
    expect(carousel).toHaveAttribute("data-active-index", "1");
  });

  it("steps to the previous slide when the previous arrow is clicked", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const desktopStrip = getDesktopStrip(container);
    const carousel = getDesktopCarousel(container);

    fireEvent.click(desktopStrip.querySelector('[aria-label="Previous slide"]')!);
    expect(carousel).toHaveAttribute("data-active-index", "2");
  });

  it("advances to the next slide when dragged left by touch", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const carousel = getDesktopCarousel(container);

    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "touch", button: 0, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "touch", clientX: 180 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "touch", clientX: 180 });

    expect(carousel).toHaveAttribute("data-active-index", "1");
  });

  it("goes to the previous slide when dragged right", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const carousel = getDesktopCarousel(container);

    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 180 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 300 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 300 });

    expect(carousel).toHaveAttribute("data-active-index", "2");
  });

  it("ignores non-primary mouse buttons", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const carousel = getDesktopCarousel(container);

    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 2, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });

    expect(carousel).toHaveAttribute("data-active-index", "0");
  });

  it("does not advance when the drag is below the swipe threshold", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const carousel = getDesktopCarousel(container);

    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 280 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 280 });

    expect(carousel).toHaveAttribute("data-active-index", "0");
  });

  it("suppresses the link click that follows a real drag", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const desktopStrip = getDesktopStrip(container);
    const carousel = getDesktopCarousel(container);
    const link = desktopStrip.querySelector('[aria-label="Media 1"]')!;

    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });

    expect(fireEvent.click(link)).toBe(false);
  });

});
