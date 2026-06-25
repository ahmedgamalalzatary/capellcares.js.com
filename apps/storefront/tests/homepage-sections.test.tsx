import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/homepage-banners", () => ({
  getHomepageBanners: vi.fn(async () => ({
    sections: {
      hero_primary: {
        key: "hero_primary",
        behavior: "carousel",
        items: [
          { id: 1, imagePath: "/uploads/hero-1.png", href: "/products/p1" },
          { id: 2, imagePath: "/uploads/hero-2.png", href: "/products/p2" }
        ]
      },
      grid_featured: {
        key: "grid_featured",
        behavior: "manual-grid",
        items: Array.from({ length: 5 }, (_, index) => ({
          id: index + 10,
          imagePath: `/uploads/grid-${index + 1}.png`,
          href: `/offers/${index + 1}`
        }))
      },
      single_mid: {
        key: "single_mid",
        behavior: "single-image",
        items: [{ id: 20, imagePath: "/uploads/single-1.png", href: "/collections/1" }]
      },
      hero_secondary: {
        key: "hero_secondary",
        behavior: "carousel",
        items: [{ id: 30, imagePath: "/uploads/hero-3.png", href: "/products/p3" }]
      },
      single_footer: {
        key: "single_footer",
        behavior: "single-image",
        items: [{ id: 40, imagePath: "/uploads/single-2.png", href: "/collections/2" }]
      }
    }
  }))
}));

import HomePage from "@/app/page";

describe("HomePage homepage sections", () => {
  it("renders carousel, four-up grid, and single-image sections", async () => {
    render(await HomePage());

    expect(screen.getByRole("region", { name: "Homepage hero primary" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Homepage featured grid" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Homepage single middle" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Homepage hero secondary" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Homepage single footer" })).toBeInTheDocument();
    expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(8);
  });
});
