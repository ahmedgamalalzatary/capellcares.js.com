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
});
