import type {
  Offer,
  Product,
  StorefrontCollectionDetail,
  StorefrontOfferDetail,
  StorefrontProductDetail,
  RelatedItemCard
} from "@capella/shared";

export type FetchLanguage = "ar" | "en";

export type ProductApiShape = Product & {
  media?: Array<{ type: "image" | "video"; url: string }>;
  imagePath?: string | null;
  hoverImagePath?: string | null;
};

export type ProductDetailApiShape = Omit<ProductApiShape, "relatedItems"> & {
  relatedItems?: RelatedItemCard[];
  reviewData: StorefrontProductDetail["reviewData"];
};

export type OfferDetailApiShape = Omit<Offer, "relatedItems"> & {
  relatedItems?: RelatedItemCard[];
  reviewData: StorefrontOfferDetail["reviewData"];
};

export type CollectionDetailApiShape = Omit<StorefrontCollectionDetail, "relatedItems"> & {
  relatedItems?: RelatedItemCard[];
};

export type CategoryApiShape = {
  id: number;
  parentId: number | null;
  slug: string;
  imagePath?: string | null;
  sortOrder?: number;
  createdAt?: string;
  name?: { ar?: string; en?: string };
  arName?: string;
  enName?: string;
  isLeaf?: boolean;
  deletedAt?: string | null;
};
