import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductCard } from "@/components/homepage/ProductCard";
import { dictionaries } from "@minikoshk/shared";
import type { StorefrontProduct } from "@/lib/products";

afterEach(cleanup);

describe("ProductCard", () => {
  it("links each available swatch to a complete in-stock variant selection", () => {
    const product: StorefrontProduct = {
      id: 1,
      slug: "swatches",
      name: { ar: "ألوان", en: "Swatches" },
      keywords: [], imagePath: "/product.png", media: [], status: "active", isNew: false, isBestseller: false,
      sizes: [{ id: 1, label: "S", sortOrder: 1 }, { id: 2, label: "M", sortOrder: 2 }],
      colors: [{ id: 10, hex: "#FFFFFF", sortOrder: 1 }, { id: 11, hex: "#000000", sortOrder: 2 }],
      variants: [
        { id: 101, sizeId: 1, colorId: 10, price: 20, stock: 0 },
        { id: 102, sizeId: 2, colorId: 10, price: 20, stock: 3 }
      ]
    };

    render(<ProductCard product={product} lang="en" dict={dictionaries.en} />);

    expect(screen.getByRole("link", { name: "Color #FFFFFF" })).toHaveAttribute(
      "href",
      "/en/shop?product=swatches&size=2&color=10&variant=102"
    );
    expect(screen.queryByRole("link", { name: "Color #000000" })).not.toBeInTheDocument();
  });
});
