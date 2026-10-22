import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

import { CardImageCarousel, NoCardImageSwipe } from "@/components/ui/card-image-carousel";
import { buildCardImages } from "@/lib/card-images";
import { useCardSliderScreen } from "../helpers/media-query";

afterEach(cleanup);

const renderImage = (url: string) => createElement("img", { src: url, alt: "Product" });
const images = ["/one.jpg", "/two.jpg", "/three.jpg", "/four.jpg"];

function renderCarousel({ lang = "en", list = images, hoverImage = "/hover.jpg", swipe = true }: { lang?: "en" | "ar"; list?: string[]; hoverImage?: string | null; swipe?: boolean } = {}) {
  const carousel = createElement(CardImageCarousel, { images: list, hoverImage, href: "/en/products/p", label: "Product", lang, renderImage });
  render(swipe ? carousel : createElement(NoCardImageSwipe, null, carousel));
  return {
    link: screen.getByRole("link", { name: "Product" }),
    slide: () => screen.getByTestId("card-image-carousel").getAttribute("data-active-index"),
    shown: () => screen.getByRole("img", { name: "Product" }).getAttribute("src")
  };
}

function swipe(target: HTMLElement, fromX: number, toX: number, pointerType = "touch") {
  Object.assign(target, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true) });
  fireEvent.pointerDown(target, { clientX: fromX, clientY: 100, pointerId: 1, pointerType, isPrimary: true });
  fireEvent.pointerMove(target, { clientX: (fromX + toX) / 2, clientY: 102, pointerId: 1, pointerType, isPrimary: true });
  fireEvent.pointerMove(target, { clientX: toX, clientY: 103, pointerId: 1, pointerType, isPrimary: true });
  fireEvent.pointerUp(target, { clientX: toX, clientY: 103, pointerId: 1, pointerType, isPrimary: true });
}

const swipeForward = (target: HTMLElement) => swipe(target, 300, 150);
const swipeBack = (target: HTMLElement) => swipe(target, 150, 300);

describe("buildCardImages", () => {
  it("leads with the main image, then the rest of the gallery, leaving out the hover image, videos and repeats", () => {
    // A whole catalog item goes in, hover image included.
    const item = {
      imagePath: "/main.jpg",
      hoverImagePath: "/hover.jpg",
      media: [
        { type: "image", arUrl: null, enUrl: "/main.jpg" },
        { type: "video", url: "/clip.mp4" },
        { type: "image", arUrl: null, enUrl: "/third.jpg" },
        { type: "image", arUrl: null, enUrl: "/third.jpg" }
      ]
    } satisfies Parameters<typeof buildCardImages>[0] & { hoverImagePath: string };
    expect(buildCardImages(item, "en")).toEqual(["/main.jpg", "/third.jpg"]);
  });

  it("uses the localized gallery image for the language being shown", () => {
    const entity = {
      imagePath: "/en.jpg",
      media: [
        { type: "image" as const, arUrl: "/ar.jpg", enUrl: "/en.jpg" },
        { type: "image" as const, arUrl: null, enUrl: "/second.jpg" }
      ]
    };
    expect(buildCardImages(entity, "ar")).toEqual(["/ar.jpg", "/second.jpg"]);
    expect(buildCardImages(entity, "en")).toEqual(["/en.jpg", "/second.jpg"]);
  });

  it("falls back to the main image path when there is no gallery", () => {
    expect(buildCardImages({ imagePath: "/main.jpg" }, "en")).toEqual(["/main.jpg"]);
    expect(buildCardImages({ imagePath: null }, "en")).toEqual([]);
  });
});

describe("CardImageCarousel on desktop", () => {
  it("shows only the main image and swaps to the hover image while the pointer is over it", () => {
    const { link, shown } = renderCarousel();
    expect(document.querySelectorAll("img")).toHaveLength(1);
    expect(shown()).toBe("/one.jpg");

    fireEvent.mouseEnter(link);
    expect(shown()).toBe("/hover.jpg");
    fireEvent.mouseLeave(link);
    expect(shown()).toBe("/one.jpg");
  });

  it("keeps the main image on hover when there is no hover image", () => {
    const { link, shown } = renderCarousel({ hoverImage: "" });
    fireEvent.mouseEnter(link);
    expect(shown()).toBe("/one.jpg");
  });

  it("zooms the picture on hover", () => {
    const { link } = renderCarousel();
    expect(link.firstElementChild?.className).toContain("group-hover:scale-[1.05]");
  });

  it("has no arrows and does not slide", () => {
    const { link, shown } = renderCarousel();
    expect(screen.queryByRole("button")).toBeNull();
    swipeForward(link);
    expect(shown()).toBe("/one.jpg");
  });

  it("still renders the artwork fallback when there are no images", () => {
    renderCarousel({ list: [] });
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });
});

describe("CardImageCarousel on touch and small screens", () => {
  beforeEach(useCardSliderScreen);

  it("starts on the main image with no arrows", () => {
    const { slide, shown } = renderCarousel();
    expect(slide()).toBe("0");
    expect(shown()).toBe("/one.jpg");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("never shows the hover image, even on hover", () => {
    const { link, shown } = renderCarousel();
    fireEvent.mouseEnter(link);
    expect(shown()).toBe("/one.jpg");
    expect(Array.from(document.querySelectorAll("img"), (img) => img.getAttribute("src"))).not.toContain("/hover.jpg");
  });

  it("changes the picture on a finger swipe and does not follow the link", () => {
    const { link, slide, shown } = renderCarousel();
    swipeForward(link);
    expect(slide()).toBe("1");
    expect(shown()).toBe("/two.jpg");

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it("goes round from the last picture back to the first", () => {
    const { link, slide, shown } = renderCarousel();
    for (let i = 0; i < 4; i++) swipeForward(link);
    expect(slide()).toBe("0");
    expect(shown()).toBe("/one.jpg");
    swipeForward(link);
    expect(slide()).toBe("1");
  });

  it("goes round from the first picture back to the last", () => {
    const { link, slide, shown } = renderCarousel();
    swipeBack(link);
    expect(slide()).toBe("3");
    expect(shown()).toBe("/four.jpg");
    swipeBack(link);
    expect(slide()).toBe("2");
  });

  it("mirrors the swipe direction on Arabic pages", () => {
    const { link, slide } = renderCarousel({ lang: "ar" });
    swipe(link, 150, 300);
    expect(slide()).toBe("1");
  });

  it("ignores mouse drags", () => {
    const { link, slide } = renderCarousel();
    swipe(link, 300, 150, "mouse");
    expect(slide()).toBe("0");
  });

  it("does not swipe a single image, so the row around it can still scroll", () => {
    const { link, slide } = renderCarousel({ list: ["/only.jpg"] });
    expect(link.className).not.toContain("touch-pan-y");
    swipeForward(link);
    expect(slide()).toBe("0");
  });

  it("still renders the artwork fallback when there are no images", () => {
    renderCarousel({ list: [] });
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });
});

describe("CardImageCarousel where image swipe is turned off", () => {
  beforeEach(useCardSliderScreen);

  it("keeps the desktop hover behavior on touch and small screens and does not swipe", () => {
    const { link, slide, shown } = renderCarousel({ swipe: false });
    expect(document.querySelectorAll("img")).toHaveLength(1);
    expect(link.className).not.toContain("touch-pan-y");

    swipeForward(link);
    expect(slide()).toBe("0");
    expect(shown()).toBe("/one.jpg");

    fireEvent.mouseEnter(link);
    expect(shown()).toBe("/hover.jpg");
  });
});
