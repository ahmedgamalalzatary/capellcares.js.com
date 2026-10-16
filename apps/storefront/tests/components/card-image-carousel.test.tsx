import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

import { CardImageCarousel } from "@/components/ui/card-image-carousel";
import { buildCardImages } from "@/lib/card-images";

afterEach(cleanup);

const renderImage = (url: string) => createElement("img", { src: url, alt: "" });
const images = ["/one.jpg", "/two.jpg", "/three.jpg"];

function renderCarousel(lang: "en" | "ar" = "en", list = images) {
  render(createElement(CardImageCarousel, { images: list, href: "/en/products/p", label: "Product", lang, renderImage }));
  return {
    link: screen.getByRole("link", { name: "Product" }),
    slide: () => screen.getByTestId("card-image-carousel").getAttribute("data-active-index")
  };
}

function swipe(target: HTMLElement, fromX: number, toX: number, pointerType = "touch") {
  Object.assign(target, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true) });
  fireEvent.pointerDown(target, { clientX: fromX, clientY: 100, pointerId: 1, pointerType, isPrimary: true });
  fireEvent.pointerMove(target, { clientX: (fromX + toX) / 2, clientY: 102, pointerId: 1, pointerType, isPrimary: true });
  fireEvent.pointerMove(target, { clientX: toX, clientY: 103, pointerId: 1, pointerType, isPrimary: true });
  fireEvent.pointerUp(target, { clientX: toX, clientY: 103, pointerId: 1, pointerType, isPrimary: true });
}

describe("buildCardImages", () => {
  it("leads with the main image, then the hover image, then the rest of the gallery, without repeats", () => {
    expect(buildCardImages({
      imagePath: "/main.jpg",
      hoverImagePath: "/hover.jpg",
      media: [
        { type: "image", arUrl: null, enUrl: "/main.jpg" },
        { type: "video", url: "/clip.mp4" },
        { type: "image", arUrl: null, enUrl: "/hover.jpg" },
        { type: "image", arUrl: null, enUrl: "/third.jpg" }
      ]
    }, "en")).toEqual(["/main.jpg", "/hover.jpg", "/third.jpg"]);
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
    expect(buildCardImages({ imagePath: "/main.jpg", hoverImagePath: "" }, "en")).toEqual(["/main.jpg"]);
    expect(buildCardImages({ imagePath: null }, "en")).toEqual([]);
  });
});

describe("CardImageCarousel", () => {
  it("renders every image as a slide and starts on the first", () => {
    const { slide } = renderCarousel();
    expect(Array.from(document.querySelectorAll("img"), (img) => img.getAttribute("src"))).toEqual(images);
    expect(slide()).toBe("0");
  });

  it("steps with the arrows and disables them at the ends", () => {
    const { slide } = renderCarousel();
    const prev = screen.getByRole("button", { name: "Previous media" });
    const next = screen.getByRole("button", { name: "Next media" });

    expect(prev).toBeDisabled();
    fireEvent.click(next);
    fireEvent.click(next);
    expect(slide()).toBe("2");
    expect(next).toBeDisabled();
    fireEvent.click(prev);
    expect(slide()).toBe("1");
  });

  it("changes the picture on a finger swipe and does not follow the link", () => {
    const { link, slide } = renderCarousel();
    swipe(link, 300, 150);
    expect(slide()).toBe("1");

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);

    swipe(link, 150, 300);
    expect(slide()).toBe("0");
  });

  it("mirrors the swipe direction on Arabic pages", () => {
    const { link, slide } = renderCarousel("ar");
    swipe(link, 150, 300);
    expect(slide()).toBe("1");
  });

  it("ignores mouse drags, which belong to the arrows on desktop", () => {
    const { link, slide } = renderCarousel();
    swipe(link, 300, 150, "mouse");
    expect(slide()).toBe("0");
  });

  it("shows no arrows or swipe for a single image, so the row around it can still scroll", () => {
    const { link } = renderCarousel("en", ["/only.jpg"]);
    expect(screen.queryByRole("button")).toBeNull();
    expect(link.className).not.toContain("touch-pan-y");
  });

  it("still renders the artwork fallback when there are no images", () => {
    renderCarousel("en", []);
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });
});
