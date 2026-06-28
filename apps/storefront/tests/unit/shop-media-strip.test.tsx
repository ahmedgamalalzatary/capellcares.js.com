import { render, fireEvent, act } from "@testing-library/react";
import { createElement } from "react";
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
      imagePath: `http://localhost:4000/uploads/img-${i + 1}.jpg`,
      mobileImagePath: `http://localhost:4000/uploads/mobile-img-${i + 1}.jpg`,
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

  it("mounts only one responsive strip instead of separate desktop and mobile strips", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(1)} label="Media" />);

    expect(container.querySelectorAll("[data-viewport]")).toHaveLength(1);
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

  it("keeps slide images on the original box model without injecting an aspect-ratio frame", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(1)} label="Media" />);

    const frame = getDesktopStrip(container).querySelector("[data-slide-frame]");
    expect(frame).toBeNull();
  });

  it("skips items without desktop images in the desktop strip", () => {
    const section = makeSection(3);
    section.items[1] = {
      ...section.items[1],
      imagePath: null,
      mobileImagePath: "http://localhost:4000/uploads/mobile-only.jpg"
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
      imagePath: null,
      mobileImagePath: `http://localhost:4000/uploads/mobile-${item.id}.jpg`
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

  it("clones the edge slides so autoplay loops seamlessly (infinite)", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const desktopStrip = getDesktopStrip(container);

    expect(desktopStrip.querySelectorAll("[data-slide]")).toHaveLength(5);
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

  it("wraps around to the first slide after the last", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(2)} label="Media" />);
    const carousel = getDesktopCarousel(container);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(carousel).toHaveAttribute("data-active-index", "1");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(carousel).toHaveAttribute("data-active-index", "0");
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

  it("advances to the next slide when dragged left by mouse", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const carousel = getDesktopCarousel(container);

    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });

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

  it("moves the slide track with the pointer while dragging", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const carousel = getDesktopCarousel(container);
    const track = getDesktopStrip(container).querySelector("[data-slide-track]");

    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 220 });

    expect(track).toHaveStyle({ transform: "translateX(calc(-100% + -80px))" });
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

  it("allows a plain click (no drag) to navigate", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);
    const desktopStrip = getDesktopStrip(container);
    const carousel = getDesktopCarousel(container);
    const link = desktopStrip.querySelector('[aria-label="Media 1"]')!;

    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 300 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 300 });

    expect(fireEvent.click(link)).toBe(true);
  });
});
