import { render, screen, fireEvent, act } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShopMediaSection } from "@capella/shared";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

import { ShopMediaStrip } from "@/components/shop/shop-media-strip";

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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a single image without carousel controls", () => {
    render(<ShopMediaStrip lang="en" section={makeSection(1)} label="Media" />);

    expect(screen.getByRole("link", { name: "Media 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /go to slide/i })).not.toBeInTheDocument();
  });

  it("renders mobile and desktop sources at the sm breakpoint", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(1)} label="Media" />);

    const source = container.querySelector("picture source");
    const image = container.querySelector("picture img");

    expect(source).toHaveAttribute("media", "(max-width: 639px)");
    expect(source).toHaveAttribute("srcSet", "http://localhost:4000/uploads/mobile-img-1.jpg");
    expect(image).toHaveAttribute("src", "http://localhost:4000/uploads/img-1.jpg");
  });

  it("renders dots and arrows when there are multiple images", () => {
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /go to slide/i })).toHaveLength(3);
  });

  it("clones the edge slides so autoplay loops seamlessly (infinite)", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    // 3 real slides + a clone of the first and last = 5 rendered slides,
    // while the dot indicators still reflect only the 3 real slides.
    expect(container.querySelectorAll("[data-slide]")).toHaveLength(5);
    expect(screen.getAllByRole("button", { name: /go to slide/i })).toHaveLength(3);
  });

  it("auto-advances to the next slide every 5 seconds", () => {
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
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
    render(<ShopMediaStrip lang="en" section={makeSection(2)} label="Media" />);

    const carousel = screen.getByRole("group");
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
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
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
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(carousel).toHaveAttribute("data-active-index", "1");
  });

  it("jumps to a slide when its dot is clicked", () => {
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
    fireEvent.click(screen.getByRole("button", { name: "Go to slide 3" }));
    expect(carousel).toHaveAttribute("data-active-index", "2");
  });

  it("advances to the next slide when dragged left by touch", () => {
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "touch", button: 0, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "touch", clientX: 180 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "touch", clientX: 180 });

    expect(carousel).toHaveAttribute("data-active-index", "1");
  });

  it("advances to the next slide when dragged left by mouse", () => {
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });

    expect(carousel).toHaveAttribute("data-active-index", "1");
  });

  it("goes to the previous slide when dragged right", () => {
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 180 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 300 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 300 });

    expect(carousel).toHaveAttribute("data-active-index", "2");
  });

  it("ignores non-primary mouse buttons", () => {
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 2, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });

    expect(carousel).toHaveAttribute("data-active-index", "0");
  });

  it("does not advance when the drag is below the swipe threshold", () => {
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 280 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 280 });

    expect(carousel).toHaveAttribute("data-active-index", "0");
  });

  it("moves the slide track with the pointer while dragging", () => {
    const { container } = render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
    const track = container.querySelector("[data-slide-track]");
    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 220 });

    expect(track).toHaveStyle({ transform: "translateX(calc(-100% + -80px))" });
  });

  it("suppresses the link click that follows a real drag", () => {
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
    // The active real slide is the link labelled "Media 1".
    const link = screen.getByRole("link", { name: "Media 1" });

    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 300 });
    fireEvent.pointerMove(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 180 });

    const clickEvent = fireEvent.click(link);
    // The drag swallows the click so navigation never fires.
    expect(clickEvent).toBe(false);
  });

  it("allows a plain click (no drag) to navigate", () => {
    render(<ShopMediaStrip lang="en" section={makeSection(3)} label="Media" />);

    const carousel = screen.getByRole("group");
    const link = screen.getByRole("link", { name: "Media 1" });

    fireEvent.pointerDown(carousel, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 300 });
    fireEvent.pointerUp(carousel, { pointerId: 1, pointerType: "mouse", clientX: 300 });

    const clickEvent = fireEvent.click(link);
    expect(clickEvent).toBe(true);
  });
});
