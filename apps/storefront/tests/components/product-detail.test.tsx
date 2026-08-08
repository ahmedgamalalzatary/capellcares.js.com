import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/components/providers/cart-provider", async () => {
  const { cartKeyOf } = await import("../helpers/cart");
  return {
    useCart: () => ({
      add: vi.fn(),
      lines: [],
      count: 0,
      setQty: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      keyOf: cartKeyOf
    })
  };
});

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({ has: () => false, toggle: vi.fn() })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 } })
}));

import { ProductDetail } from "@/components/products/product-detail";

describe("ProductDetail", () => {
  it("renders image and video media, and falls back to legacy imagePath media", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size",
        relatedOffers: "Related offers"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    const baseProduct = {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "Description" },
      ingredients: { ar: "", en: "Ingredients" },
      howToUse: { ar: "", en: "Use" },
      warnings: { ar: "", en: "Warnings" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/legacy.jpg",
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    };

    const { rerender } = render(createElement(ProductDetail, {
      product: {
        ...baseProduct,
        media: [
          { type: "image", url: "/uploads/primary.jpg" },
          { type: "image", url: "/uploads/hover.jpg" },
          { type: "video", url: "/uploads/demo.mp4" }
        ]
      },
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.getAllByRole("img", { name: "Product" })[0]).toHaveAttribute("src", "/uploads/primary.jpg");
    const videoThumbnail = screen.getByTestId("product-media-thumbs").querySelectorAll("button")[2]!;
    expect(videoThumbnail).toBeInTheDocument();

    fireEvent.click(videoThumbnail);
    expect(document.querySelector("video[controls]")).toHaveAttribute("src", "/uploads/demo.mp4");

    rerender(createElement(ProductDetail, {
      product: {
        ...baseProduct,
        media: [{ type: "image", url: "/uploads/legacy.jpg" }]
      },
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.getAllByRole("img", { name: "Product" })[0]).toHaveAttribute("src", "/uploads/legacy.jpg");
  });

  it("uses the selected language for video accessibility labels", () => {
    const dict = {
      product: { description: "Description", ingredients: "Ingredients", howToUse: "How to use", warnings: "Warnings", selectSize: "Select size" },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: { outOfStock: "Out", lowStock: "Low", inStock: "In stock", quantity: "Quantity", addToCart: "Add", added: "Added", buyNow: "Buy", addToWishlist: "Wishlist" },
      offers: { save: "Save {amount}" }
    };
    const product = {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "" },
      ingredients: { ar: "", en: "" },
      howToUse: { ar: "", en: "" },
      warnings: { ar: "", en: "" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/main.jpg",
      media: [
        { type: "image" as const, url: "/uploads/main.jpg" },
        { type: "video" as const, url: "/uploads/demo.mp4" }
      ],
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    };

    render(createElement(ProductDetail, { product, offers: [], lang: "ar", dict }));
    const videoThumbnail = screen.getByTestId("product-media-thumbs").querySelectorAll("button")[1] as HTMLButtonElement;
    fireEvent.click(videoThumbnail);
    expect(screen.getByTestId("product-media-main").querySelector("video")).toHaveAttribute("aria-label", product.name.ar);
  });

  it("switches product media only when the user drags on the main media area", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size",
        relatedOffers: "Related offers"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    render(createElement(ProductDetail, {
      product: {
        id: 1,
        sku: "SKU-1",
        slug: "product-1",
        name: { ar: "منتج", en: "Product" },
        description: { ar: "", en: "Description" },
        ingredients: { ar: "", en: "Ingredients" },
        howToUse: { ar: "", en: "Use" },
        warnings: { ar: "", en: "Warnings" },
        keywords: [],
        buyingPrice: 10,
        imagePath: "/uploads/legacy.jpg",
        media: [
          { type: "image" as const, url: "/uploads/primary.jpg" },
          { type: "image" as const, url: "/uploads/secondary.jpg" },
          { type: "video" as const, url: "/uploads/demo.mp4" }
        ],
        status: "active" as const,
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      },
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.getAllByRole("img", { name: "Product" })[0]).toHaveAttribute("src", "/uploads/primary.jpg");

    const mediaMain = screen.getByTestId("product-media-main");
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.assign(mediaMain, {
      setPointerCapture,
      releasePointerCapture,
      hasPointerCapture: vi.fn((pointerId: number) => pointerId === 1)
    });

    fireEvent.pointerDown(mediaMain, { clientX: 260, clientY: 100, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true });
    fireEvent.pointerUp(document, { clientX: 120, clientY: 110, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true });
    expect(setPointerCapture).toHaveBeenCalledWith(1);
    expect(releasePointerCapture).toHaveBeenCalledWith(1);
    expect(screen.getAllByRole("img", { name: "Product" })[0]).toHaveAttribute("src", "/uploads/secondary.jpg");

    fireEvent.pointerDown(mediaMain, { clientX: 260, clientY: 100, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true });
    fireEvent.pointerUp(document, { clientX: 120, clientY: 110, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true });
    expect(document.querySelector("video[controls]")).toHaveAttribute("src", "/uploads/demo.mp4");

    fireEvent.pointerDown(screen.getByTestId("product-media-thumbs"), { clientX: 120, clientY: 100, pointerId: 2, pointerType: "touch", button: 0, isPrimary: true });
    fireEvent.pointerUp(screen.getByTestId("product-media-thumbs"), { clientX: 260, clientY: 105, pointerId: 2, pointerType: "touch", button: 0, isPrimary: true });
    expect(document.querySelector("video[controls]")).toHaveAttribute("src", "/uploads/demo.mp4");
  });

  it("localizes media dot labels from the product dictionary", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size",
        mediaDotLabel: "انتقل إلى الوسائط {index}"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    render(createElement(ProductDetail, {
      product: {
        id: 1,
        sku: "SKU-1",
        slug: "product-1",
        name: { ar: "منتج", en: "Product" },
        description: { ar: "", en: "Description" },
        ingredients: { ar: "", en: "Ingredients" },
        howToUse: { ar: "", en: "Use" },
        warnings: { ar: "", en: "Warnings" },
        keywords: [],
        buyingPrice: 10,
        imagePath: "/uploads/legacy.jpg",
        media: [
          { type: "image" as const, url: "/uploads/primary.jpg" },
          { type: "image" as const, url: "/uploads/secondary.jpg" }
        ],
        status: "active" as const,
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      },
      offers: [],
      lang: "ar",
      dict
    }));

    expect(screen.getByRole("button", { name: "انتقل إلى الوسائط 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "انتقل إلى الوسائط 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "اختر الوسائط 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "اختر الوسائط 2" })).toBeInTheDocument();
  });

  it("shows pagination dots and switches media on click when there are 2+ media", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    const baseProduct = {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "Description" },
      ingredients: { ar: "", en: "Ingredients" },
      howToUse: { ar: "", en: "Use" },
      warnings: { ar: "", en: "Warnings" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/legacy.jpg",
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    };

    const { rerender } = render(createElement(ProductDetail, {
      product: {
        ...baseProduct,
        media: [
          { type: "image" as const, url: "/uploads/primary.jpg" },
          { type: "image" as const, url: "/uploads/secondary.jpg" }
        ]
      },
      offers: [],
      lang: "en",
      dict
    }));

    const dots = screen.getByTestId("product-media-dots");
    const dotButtons = dots.querySelectorAll("button");
    expect(dotButtons).toHaveLength(2);
    expect(dotButtons[0]).toHaveAttribute("aria-current", "true");

    fireEvent.click(dotButtons[1]!);
    expect(screen.getAllByRole("img", { name: "Product" })[0]).toHaveAttribute("src", "/uploads/secondary.jpg");
    expect(dots.querySelectorAll("button")[1]).toHaveAttribute("aria-current", "true");

    rerender(createElement(ProductDetail, {
      product: {
        ...baseProduct,
        media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }]
      },
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.queryByTestId("product-media-dots")).not.toBeInTheDocument();
  });

  it("colors the stock status chip green when in stock and red when out of stock", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    const base = {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "Description" },
      ingredients: { ar: "", en: "Ingredients" },
      howToUse: { ar: "", en: "Use" },
      warnings: { ar: "", en: "Warnings" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/legacy.jpg",
      media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      createdAt: "",
      updatedAt: ""
    };

    const { rerender } = render(createElement(ProductDetail, {
      product: { ...base, variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 12, sortOrder: 1 }] },
      offers: [],
      lang: "en",
      dict
    }));

    const inStockChip = screen.getByText("In stock");
    expect(inStockChip).toHaveClass("chip");
    expect(inStockChip.className).toContain("text-(--success)");

    rerender(createElement(ProductDetail, {
      product: { ...base, variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 0, sortOrder: 1 }] },
      offers: [],
      lang: "en",
      dict
    }));

    const outChip = screen.getAllByText("Out of stock").find((el) => el.classList.contains("chip"));
    expect(outChip).toBeTruthy();
    expect(outChip!.className).toContain("text-(--error)");
  });

  it("renders related items in order with links to their detail pages", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size",
        related: "You may also like"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    const product = {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "Description" },
      ingredients: { ar: "", en: "Ingredients" },
      howToUse: { ar: "", en: "Use" },
      warnings: { ar: "", en: "Warnings" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/legacy.jpg",
      media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    };

    render(createElement(ProductDetail, {
      product,
      offers: [],
      lang: "en",
      dict,
      relatedItems: [
        { type: "product", id: 2, slug: "related-product", name: { ar: "", en: "Related Product" }, imagePath: "/uploads/related-product.jpg", price: 30, variantId: 21, originalTotal: null, categoryName: null, rating: { average: 0, count: 0 } },
        { type: "offer", id: 3, slug: "related-offer", name: { ar: "", en: "Related Offer" }, imagePath: "/uploads/related-offer.jpg", price: 40, variantId: null, originalTotal: 55, categoryName: null, rating: { average: 0, count: 0 } },
        { type: "collection", id: 4, slug: "related-collection", name: { ar: "", en: "Related Collection" }, imagePath: "/uploads/related-collection.jpg", price: 60, variantId: null, originalTotal: 75, categoryName: null, rating: { average: 0, count: 0 } }
      ]
    }));

    const rows = screen.getAllByTestId("related-item");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Related Product");
    expect(rows[0]!.querySelector("a")).toHaveAttribute("href", "/en/products/related-product");
    expect(screen.getByRole("img", { name: "Related Product" })).toHaveAttribute("src", "/uploads/related-product.jpg");
    expect(rows[0]).toHaveTextContent("Product");
    expect(rows[0]).toHaveTextContent("30");
    expect(rows[1]).toHaveTextContent("Related Offer");
    expect(rows[1]!.querySelector("a")).toHaveAttribute("href", "/en/offers/related-offer");
    expect(screen.getByRole("img", { name: "Related Offer" })).toHaveAttribute("src", "/uploads/related-offer.jpg");
    expect(rows[1]).toHaveTextContent("Offer");
    expect(rows[1]).toHaveTextContent("40");
    expect(rows[2]).toHaveTextContent("Related Collection");
    expect(rows[2]!.querySelector("a")).toHaveAttribute("href", "/en/collections/related-collection");
    expect(screen.getByRole("img", { name: "Related Collection" })).toHaveAttribute("src", "/uploads/related-collection.jpg");
    expect(rows[2]).toHaveTextContent("Collection");
    expect(rows[2]).toHaveTextContent("60");
  });

  it("floats the new/bestseller lead tag over the media instead of listing it in the badge row", () => {
    const dict = {
      product: { description: "Description", ingredients: "Ingredients", howToUse: "How to use", warnings: "Warnings", selectSize: "Select size" },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: { outOfStock: "Out of stock", lowStock: "Only {n}", inStock: "In stock", quantity: "Quantity", addToCart: "Add to cart", added: "Added", buyNow: "Buy now", addToWishlist: "Wishlist" },
      offers: { save: "Save {amount}" }
    };

    const product = {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "Description" },
      ingredients: { ar: "", en: "Ingredients" },
      howToUse: { ar: "", en: "Use" },
      warnings: { ar: "", en: "Warnings" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/legacy.jpg",
      media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
      status: "active" as const,
      isNew: true,
      isBestseller: true,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    };

    render(createElement(ProductDetail, { product, offers: [], lang: "en", dict }));

    const frame = screen.getByTestId("product-media-main").parentElement as HTMLElement;

    // A single lead tag, styled exactly like the card tags.
    const tag = frame.querySelector("span.absolute") as HTMLElement;
    expect(tag).toHaveTextContent("New");
    expect(tag.className).toContain("top-0");
    expect(tag.className).toContain("inset-s-0");
    expect(tag.className).toContain("rounded-ss-lg");

    const heart = frame.querySelector("button") as HTMLElement;
    expect(heart).toHaveAttribute("aria-label", "Wishlist");
    expect(heart.className).toContain("inset-e-2");
    expect(heart.className).not.toContain("inset-s-2");

    // The information section no longer repeats them as CSS badges.
    const badgeTexts = Array.from(document.querySelectorAll(".badge")).map((el) => el.textContent);
    expect(badgeTexts).toHaveLength(0);
  });

  it("floats no tag for a product that is neither new nor a bestseller, and keeps its offer badges", () => {
    const dict = {
      product: { description: "Description", ingredients: "Ingredients", howToUse: "How to use", warnings: "Warnings", selectSize: "Select size" },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: { outOfStock: "Out of stock", lowStock: "Only {n}", inStock: "In stock", quantity: "Quantity", addToCart: "Add to cart", added: "Added", buyNow: "Buy now", addToWishlist: "Wishlist" },
      offers: { save: "Save {amount}" }
    };

    const product = {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "Description" },
      ingredients: { ar: "", en: "Ingredients" },
      howToUse: { ar: "", en: "Use" },
      warnings: { ar: "", en: "Warnings" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/legacy.jpg",
      media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      offerIds: [3],
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    };

    render(createElement(ProductDetail, {
      product,
      offers: [{
        id: 3,
        slug: "duo",
        name: { ar: "عرض", en: "Duo" },
        description: { ar: "", en: "" },
        imagePath: "",
        price: 70,
        originalTotal: 90,
        categoryId: 5,
        items: [],
        stock: 4,
        status: "active" as const,
        visibility: "visible" as const,
        createdAt: "",
        updatedAt: ""
      }],
      lang: "en",
      dict
    }));

    const frame = screen.getByTestId("product-media-main").parentElement as HTMLElement;
    expect(frame.querySelector("span.absolute")).toBeNull();

    // The linked offer badge still lives in the information section.
    const offerBadge = screen.getByRole("link", { name: /Duo/ });
    expect(offerBadge).toHaveClass("badge");
    expect(offerBadge).toHaveAttribute("href", "/en/offers/duo");
  });

  it("shares the product link via the Web Share API when supported", () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });

    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist",
        share: "Share",
        linkCopied: "Link copied"
      },
      offers: { save: "Save {amount}" }
    };

    render(createElement(ProductDetail, {
      product: {
        id: 1,
        sku: "SKU-1",
        slug: "product-1",
        name: { ar: "منتج", en: "Product" },
        description: { ar: "", en: "Description" },
        ingredients: { ar: "", en: "Ingredients" },
        howToUse: { ar: "", en: "Use" },
        warnings: { ar: "", en: "Warnings" },
        keywords: [],
        buyingPrice: 10,
        imagePath: "/uploads/legacy.jpg",
        media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
        status: "active" as const,
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      },
      offers: [],
      lang: "en",
      dict
    }));

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(share).toHaveBeenCalledWith({ title: "Product", url: `${window.location.origin}/en/products/product-1` });

    delete (navigator as any).share;
  });

  it("falls back to copying the link when the Web Share API is unavailable", async () => {
    delete (navigator as any).share;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist",
        share: "Share",
        linkCopied: "Link copied"
      },
      offers: { save: "Save {amount}" }
    };

    render(createElement(ProductDetail, {
      product: {
        id: 1,
        sku: "SKU-1",
        slug: "product-1",
        name: { ar: "منتج", en: "Product" },
        description: { ar: "", en: "Description" },
        ingredients: { ar: "", en: "Ingredients" },
        howToUse: { ar: "", en: "Use" },
        warnings: { ar: "", en: "Warnings" },
        keywords: [],
        buyingPrice: 10,
        imagePath: "/uploads/legacy.jpg",
        media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
        status: "active" as const,
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      },
      offers: [],
      lang: "en",
      dict
    }));

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/en/products/product-1`);
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
  });

  it("falls back to copying the link when the Web Share API rejects with a non-abort error", async () => {
    const share = vi.fn().mockRejectedValue(new Error("share failed"));
    Object.assign(navigator, { share });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist",
        share: "Share",
        linkCopied: "Link copied"
      },
      offers: { save: "Save {amount}" }
    };

    render(createElement(ProductDetail, {
      product: {
        id: 1,
        sku: "SKU-1",
        slug: "product-1",
        name: { ar: "منتج", en: "Product" },
        description: { ar: "", en: "Description" },
        ingredients: { ar: "", en: "Ingredients" },
        howToUse: { ar: "", en: "Use" },
        warnings: { ar: "", en: "Warnings" },
        keywords: [],
        buyingPrice: 10,
        imagePath: "/uploads/legacy.jpg",
        media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
        status: "active" as const,
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      },
      offers: [],
      lang: "en",
      dict
    }));

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(await screen.findByText("Link copied")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/en/products/product-1`);

    delete (navigator as any).share;
  });

  it("renders an unavailable state instead of crashing when the product has no variants", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size",
        related: "You may also like"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    const product = {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "Description" },
      ingredients: { ar: "", en: "Ingredients" },
      howToUse: { ar: "", en: "Use" },
      warnings: { ar: "", en: "Warnings" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/legacy.jpg",
      media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [],
      createdAt: "",
      updatedAt: ""
    };

    render(createElement(ProductDetail, {
      product,
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.getAllByText("Out of stock")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Buy now" })).toBeDisabled();
  });

  it("shows out-of-stock instead of a price for a selected zero-stock variant", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size",
        related: "You may also like"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    render(createElement(ProductDetail, {
      product: {
        id: 1,
        sku: "SKU-1",
        slug: "product-1",
        name: { ar: "منتج", en: "Product" },
        description: { ar: "", en: "Description" },
        ingredients: { ar: "", en: "Ingredients" },
        howToUse: { ar: "", en: "Use" },
        warnings: { ar: "", en: "Warnings" },
        keywords: [],
        buyingPrice: 10,
        imagePath: "/uploads/legacy.jpg",
        media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
        status: "active" as const,
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [
          { id: 11, productId: 1, size: "100ml", price: 50, stock: 0, sortOrder: 1 }
        ],
        createdAt: "",
        updatedAt: ""
      },
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.getAllByText("Out of stock").length).toBeGreaterThanOrEqual(2);
    const primaryPrice = document.querySelector(".text-3xl, .sm\\:text-\\[40px\\]");
    expect(primaryPrice).toHaveTextContent("Out of stock");
  });

  it("opens the full verified reviews and loads the remaining pages", async () => {
    const dict = {
      product: { description: "Description", ingredients: "Ingredients", howToUse: "How to use", warnings: "Warnings", selectSize: "Select size" },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: { outOfStock: "Out of stock", lowStock: "Only {n}", inStock: "In stock", quantity: "Quantity", addToCart: "Add to cart", added: "Added", buyNow: "Buy now", addToWishlist: "Wishlist" },
      offers: { save: "Save {amount}" },
      reviews: { title: "Customer reviews", outOfFive: "{rating} out of 5", reviewCount: "{count} reviews", verifiedPurchase: "Verified purchase", close: "Close", noReviews: "No reviews yet", loadMore: "Load more", loading: "Loading…", loadError: "Could not load reviews" }
    };
    const product = {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "Description" },
      ingredients: { ar: "", en: "Ingredients" },
      howToUse: { ar: "", en: "Use" },
      warnings: { ar: "", en: "Warnings" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/legacy.jpg",
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2 }],
      createdAt: "",
      updatedAt: "",
      reviewData: {
        summary: { averageRating: 4.5, reviewCount: 2, distribution: { "1": 0, "2": 0, "3": 0, "4": 1, "5": 1 } },
        items: [{ id: 7, firstName: "Sara", rating: 5, comment: "Wonderful product", createdAt: "2026-08-01T00:00:00.000Z", verifiedPurchase: true as const }],
        pagination: { page: 1, pageSize: 1, total: 2, totalPages: 2 }
      }
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...product.reviewData,
        items: [{ id: 8, firstName: "Mona", rating: 4, comment: "Second comment", createdAt: "2026-08-02T00:00:00.000Z", verifiedPurchase: true }],
        pagination: { page: 2, pageSize: 1, total: 2, totalPages: 2 }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(ProductDetail, { product, offers: [], lang: "en", dict }));
    fireEvent.click(screen.getByRole("button", { name: "4.5 out of 5, 2 reviews" }));

    expect(screen.getByRole("dialog", { name: "Customer reviews" })).toBeInTheDocument();
    expect(screen.getByText("Wonderful product")).toBeInTheDocument();
    expect(screen.getByText("Sara")).toBeInTheDocument();
    expect(screen.getByText("Verified purchase")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Second comment")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/v1/reviews/product/1?page=2&pageSize=1");
    vi.unstubAllGlobals();
  });
});
