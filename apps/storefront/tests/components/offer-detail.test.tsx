import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

const { cartAdd } = vi.hoisted(() => ({ cartAdd: vi.fn() }));
const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush })
}));

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

const has = vi.fn(() => false);
const toggle = vi.fn();

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({ has, toggle })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 } })
}));

beforeEach(() => {
  vi.clearAllMocks();
  has.mockReturnValue(false);
  cartAdd.mockReset();
  routerPush.mockReset();
});
import { OfferDetail } from "@/components/offers/offer-detail";

const dict = {
  offers: {
    badge: "Offer",
    bundleEyebrow: "Bundle",
    save: "Save {amount}",
    includes: "Includes",
    added: "Added",
    addBundleToCart: "Add bundle",
    unavailable: "Unavailable",
    related: "You may also like",
    categoryLabel: "Category",
    saveToWishlist: "Save offer"
  },
  common: { buyNow: "Buy now", addToWishlist: "Wishlist", share: "Share", linkCopied: "Link copied" }
};

const offer = {
  id: 1,
  slug: "offer-1",
  name: { ar: "عرض", en: "Offer" },
  description: { ar: "", en: "Description" },
  imagePath: "",
  price: 80,
  originalTotal: 100,
  items: [],
  stock: 3,
  status: "active" as const,
  categoryId: 5,
  visibility: "visible" as const,
  createdAt: "",
  updatedAt: ""
};

describe("OfferDetail", () => {
  it("shows the offer selling price before an additional discount", () => {
    render(createElement(OfferDetail, { offer: { ...offer, price: 64, basePrice: 80 }, items: [], lang: "en", dict, relatedItems: [] }));
    expect(screen.getByLabelText("Offer price before extra discount")).toHaveTextContent("80");
  });
  it("renders and navigates the ordered offer media gallery", () => {
    render(createElement(OfferDetail, {
      offer: {
        ...offer,
        imagePath: "/uploads/offer-main.jpg",
        media: [
          { type: "image", arUrl: null, enUrl: "/uploads/offer-main.jpg" },
          { type: "image", arUrl: null, enUrl: "/uploads/offer-detail.jpg" },
          { type: "video", url: "/uploads/offer-demo.mp4" }
        ]
      },
      items: [],
      lang: "en",
      dict,
      relatedItems: []
    }));

    expect(screen.getByTestId("offer-media-dots").children).toHaveLength(3);
    fireEvent.click(screen.getByTestId("offer-media-thumbs").querySelectorAll("button")[1]!);
    expect(screen.getByTestId("offer-media-main").querySelector("img")).toHaveAttribute("src", "/uploads/offer-detail.jpg");
    fireEvent.click(screen.getByTestId("offer-media-thumbs").querySelectorAll("button")[2]!);
    expect(screen.getByTestId("offer-media-main").querySelector("video")).toHaveAttribute("src", "/uploads/offer-demo.mp4");
  });

  it("appends the optional YouTube link after all offer media", () => {
    render(createElement(OfferDetail, {
      offer: {
        ...offer,
        youtubeUrl: "https://www.youtube.com/watch?v=offer-video",
        media: [{ type: "image", arUrl: null, enUrl: "/uploads/offer-main.jpg" }]
      },
      items: [],
      lang: "en",
      dict,
      relatedItems: []
    }));

    const thumbnails = screen.getByTestId("offer-media-thumbs").querySelectorAll("button");
    expect(thumbnails).toHaveLength(2);
    expect(thumbnails[1]!.querySelector("img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/offer-video/sddefault.jpg"
    );
  });

  it("uses the selected language for video accessibility labels", () => {
    render(createElement(OfferDetail, {
      offer: {
        ...offer,
        media: [
          { type: "image", arUrl: null, enUrl: "/uploads/offer-main.jpg" },
          { type: "video", url: "/uploads/offer-demo.mp4" }
        ]
      },
      items: [],
      lang: "ar",
      dict,
      relatedItems: []
    }));

    const videoThumbnail = screen.getByTestId("offer-media-thumbs").querySelectorAll("button")[1] as HTMLButtonElement;
    fireEvent.click(videoThumbnail);
    expect(screen.getByTestId("offer-media-main").querySelector("video")).toHaveAttribute("aria-label", offer.name.ar);
  });

  it("renders related items in order with links to their detail pages", () => {
    render(createElement(OfferDetail, {
      offer,
      items: [],
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
    expect(rows[0]!.querySelector("a")).toHaveAttribute("href", "/en/products/related-product");
    expect(rows[1]!.querySelector("a")).toHaveAttribute("href", "/en/offers/related-offer");
    expect(rows[2]!.querySelector("a")).toHaveAttribute("href", "/en/collections/related-collection");
    expect(screen.getByRole("img", { name: "Related Product" })).toHaveAttribute("src", "/uploads/related-product.jpg");
    expect(screen.getByRole("img", { name: "Related Offer" })).toHaveAttribute("src", "/uploads/related-offer.jpg");
    expect(screen.getByRole("img", { name: "Related Collection" })).toHaveAttribute("src", "/uploads/related-collection.jpg");
  });

  it("renders no related section when there are none", () => {
    render(createElement(OfferDetail, { offer, items: [], lang: "en", dict, relatedItems: [] }));
    expect(screen.queryByTestId("related-items")).toBeNull();
  });

  it("adds the offer to the cart from the detail page", () => {
    render(createElement(OfferDetail, { offer, items: [], lang: "en", dict, relatedItems: [] }));

    fireEvent.click(screen.getByRole("button", { name: "Add bundle" }));

    expect(cartAdd).toHaveBeenCalledWith({ type: "offer", offerId: 1, qty: 1 });
  });

  it("buys now by adding the offer and going straight to checkout", () => {
    render(createElement(OfferDetail, { offer, items: [], lang: "en", dict, relatedItems: [] }));

    fireEvent.click(screen.getByRole("button", { name: "Buy now" }));

    expect(cartAdd).toHaveBeenCalledWith({ type: "offer", offerId: 1, qty: 1 });
    expect(routerPush).toHaveBeenCalledWith("/en/checkout");
  });

  const line = (available: number) => ({
  product: {
    id: 1,
    sku: "SKU-1",
    slug: "rose-serum",
    name: { ar: "سيروم", en: "Serum" },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" },
    keywords: [],
    buyingPrice: 0,
    imagePath: "",
    media: [],
    status: "active" as const,
    isNew: false,
    isBestseller: false,
    categoryId: 1,
    variants: [],
    createdAt: "",
    updatedAt: ""
  },
  variantId: 11,
  qty: 2,
  available,
  unitPrice: 40,
  size: "30ml"
});

it("disables both purchase actions when a line is short on stock", () => {
    render(createElement(OfferDetail, {
      offer,
      // The offer needs 2 of the variant but only 1 is on hand.
      items: [line(1)],
      lang: "en",
      dict,
      relatedItems: []
    }));

    expect(screen.getByRole("button", { name: "Add bundle" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Buy now" })).toBeDisabled();
  });

  it("keeps both purchase actions enabled when every line is in stock", () => {
    render(createElement(OfferDetail, {
      offer,
      items: [line(5)],
      lang: "en",
      dict,
      relatedItems: []
    }));

    expect(screen.getByRole("button", { name: "Add bundle" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Buy now" })).toBeEnabled();
  });

  it("adds the offer to wishlist", () => {
    render(createElement(OfferDetail, { offer, items: [], lang: "en", dict, relatedItems: [] }));

    fireEvent.click(screen.getByRole("button", { name: "Save offer" }));
    expect(toggle).toHaveBeenCalledWith("offer", 1);
  });

  it("shows the offer rating summary on the detail page", () => {
    const reviewData = {
      summary: { averageRating: 5, reviewCount: 1, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 1 } },
      items: [],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
    };
    const reviews = { title: "Customer reviews", outOfFive: "{rating} out of 5", reviewCount: "{count} reviews", verifiedPurchase: "Verified purchase", close: "Close", noReviews: "No reviews yet" };

    render(createElement(OfferDetail, { offer: { ...offer, reviewData }, items: [], lang: "en", dict: { ...dict, reviews } }));

    expect(screen.getByRole("button", { name: "5.0 out of 5, 1 reviews" })).toBeInTheDocument();
  });
});

describe("OfferDetail media overlay", () => {
  it("overlays the offer tag on the media and offers a wishlist control", () => {
    render(createElement(OfferDetail, { offer, items: [], lang: "en", dict, relatedItems: [] }));

    const frame = screen.getByTestId("offer-media-main").parentElement as HTMLElement;

    expect(frame.querySelector("span.absolute")).toHaveTextContent("Offer");
    expect(within(frame).getByRole("button", { name: "Save offer" })).toBeInTheDocument();
  });
});

describe("OfferDetail category", () => {
  it("shows the offer category line when a category is supplied", () => {
    render(createElement(OfferDetail, {
      offer,
      category: { id: 5, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false },
      items: [],
      lang: "en",
      dict,
      relatedItems: []
    }));

    expect(screen.getByText("Category: Skin Care")).toBeInTheDocument();
  });

  it("omits the category line for an uncategorised legacy offer", () => {
    render(createElement(OfferDetail, { offer, items: [], lang: "en", dict, relatedItems: [] }));

    expect(screen.queryByText(/Category:/)).not.toBeInTheDocument();
  });

  it("shows each included product's classification", () => {
    render(createElement(OfferDetail, {
      offer,
      items: [{
        qty: 1,
        variantId: 11,
        size: "30ml",
        unitPrice: 200,
        available: 4,
        product: {
          id: 1,
          slug: "rose-serum",
          name: { ar: "سيروم الورد", en: "Rose Serum" },
          categoryId: 5
        }
      }],
      categories: [
        { id: 5, parentId: null, slug: "serums", name: { ar: "سيرومات", en: "Serums" }, isLeaf: true }
      ],
      lang: "en",
      dict,
      relatedItems: []
    } as any));

    expect(screen.getByText("Rose Serum")).toBeInTheDocument();
    expect(screen.getByText("Serums")).toBeInTheDocument();
  });
});
