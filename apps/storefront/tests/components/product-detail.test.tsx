import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush })
}));

const { cartAdd } = vi.hoisted(() => ({ cartAdd: vi.fn() }));

vi.mock("@/components/providers/cart-provider", async () => {
  const { cartKeyOf } = await import("../helpers/cart");
  return {
    useCart: () => ({
      add: cartAdd,
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
          { type: "image", arUrl: null, enUrl: "/uploads/primary.jpg" },
          { type: "image", arUrl: null, enUrl: "/uploads/hover.jpg" },
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
        media: [{ type: "image", arUrl: null, enUrl: "/uploads/legacy.jpg" }]
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
        { type: "image" as const, arUrl: null, enUrl: "/uploads/main.jpg" },
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

  describe("info tabs", () => {
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
      media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/main.jpg" }],
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    };
    const renderDetail = (overrides: Partial<typeof product>) =>
      render(createElement(ProductDetail, { product: { ...product, ...overrides }, offers: [], lang: "en", dict }));

    it("hides empty and whitespace-only tabs", () => {
      renderDetail({
        description: { ar: "", en: "About it" },
        ingredients: { ar: "   ", en: "  " },
        warnings: { ar: "", en: "Keep away" }
      });

      expect(screen.getByRole("button", { name: "Description" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Warnings" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Ingredients" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "How to use" })).not.toBeInTheDocument();
      expect(screen.getByText("About it")).toBeInTheDocument();
    });

    it("opens the first filled tab when the description is empty", () => {
      renderDetail({ howToUse: { ar: "", en: "Apply daily" } });

      expect(screen.queryByRole("button", { name: "Description" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "How to use" })).toHaveAttribute("data-active", "true");
      expect(screen.getByText("Apply daily")).toBeInTheDocument();
    });

    it("shows a tab filled in the other language only", () => {
      renderDetail({ ingredients: { ar: "ماء", en: "" } });

      expect(screen.getByRole("button", { name: "Ingredients" })).toBeInTheDocument();
      expect(screen.getByText("ماء")).toBeInTheDocument();
    });

    it("renders no tabs when every section is empty", () => {
      renderDetail({});

      for (const name of ["Description", "Ingredients", "How to use", "Warnings"]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
    });
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
          { type: "image" as const, arUrl: null, enUrl: "/uploads/primary.jpg" },
          { type: "image" as const, arUrl: null, enUrl: "/uploads/secondary.jpg" },
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
          { type: "image" as const, arUrl: null, enUrl: "/uploads/primary.jpg" },
          { type: "image" as const, arUrl: null, enUrl: "/uploads/secondary.jpg" }
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
          { type: "image" as const, arUrl: null, enUrl: "/uploads/primary.jpg" },
          { type: "image" as const, arUrl: null, enUrl: "/uploads/secondary.jpg" }
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
        media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/legacy.jpg" }]
      },
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.queryByTestId("product-media-dots")).not.toBeInTheDocument();
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
      media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/legacy.jpg" }],
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
        media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/legacy.jpg" }],
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
        media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/legacy.jpg" }],
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
        media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/legacy.jpg" }],
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
      media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/legacy.jpg" }],
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
        media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/legacy.jpg" }],
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

  it("shows the product's linked video as the last item in the media gallery", () => {
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
        imagePath: "/uploads/primary.jpg",
        status: "active" as const,
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        media: [
          { type: "image" as const, arUrl: null, enUrl: "/uploads/primary.jpg" },
          { type: "image" as const, arUrl: null, enUrl: "/uploads/hover.jpg" }
        ],
        youtubeUrl: "https://www.youtube.com/watch?v=capella",
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      },
      offers: [],
      lang: "en",
      dict
    }));

    const thumbnails = screen.getByTestId("product-media-thumbs").querySelectorAll("button");
    expect(thumbnails).toHaveLength(3);

    fireEvent.click(thumbnails[2]!);
    expect(screen.getByTestId("product-media-main").querySelector("iframe")).toHaveAttribute(
      "src",
      expect.stringContaining("https://www.youtube.com/embed/capella?")
    );
  });

  describe("purchase actions", () => {
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
      media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/legacy.jpg" }],
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      createdAt: "",
      updatedAt: ""
    };

    const withVariant = (stock: number) => ({
      ...product,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock, sortOrder: 1 }]
    });

    beforeEach(() => {
      cartAdd.mockReset();
      routerPush.mockReset();
    });

    it("adds the selected variant to the cart and shows the added label", () => {
      render(createElement(ProductDetail, { product: withVariant(3), offers: [], lang: "en", dict }));

      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

      expect(cartAdd).toHaveBeenCalledWith({ type: "product", productId: 1, variantId: 11, qty: 1 });
    });

    it("buys now by adding the line and going straight to checkout", () => {
      render(createElement(ProductDetail, { product: withVariant(3), offers: [], lang: "ar", dict }));

      fireEvent.click(screen.getByRole("button", { name: "Buy now" }));

      expect(cartAdd).toHaveBeenCalledWith({ type: "product", productId: 1, variantId: 11, qty: 1 });
      expect(routerPush).toHaveBeenCalledWith("/ar/checkout");
    });

    it("disables both purchase buttons for an out-of-stock variant", () => {
      render(createElement(ProductDetail, { product: withVariant(0), offers: [], lang: "en", dict }));

      expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Buy now" })).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
      expect(cartAdd).not.toHaveBeenCalled();
    });

    it("sends the chosen quantity, not always one", () => {
      render(createElement(ProductDetail, { product: withVariant(5), offers: [], lang: "en", dict }));

      fireEvent.click(screen.getByRole("button", { name: "+" }));
      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

      expect(cartAdd).toHaveBeenCalledWith({ type: "product", productId: 1, variantId: 11, qty: 2 });
    });
  });
});
