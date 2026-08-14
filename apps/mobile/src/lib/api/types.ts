import type {
  Collection,
  Offer,
  Product,
  RelatedItemCard,
  StorefrontCollectionDetail,
  StorefrontOfferDetail,
  StorefrontProductDetail
} from "@capella/shared";

export type FetchLanguage = "ar" | "en";

export type ProductApiShape = Omit<Product, "imagePath" | "hoverImagePath"> & {
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

export type CollectionDetailApiShape = Omit<
  StorefrontCollectionDetail,
  "relatedItems"
> & {
  relatedItems?: RelatedItemCard[];
};

export type CategoryApiShape = {
  id: number | string;
  parentId: number | string | null;
  slug: string;
  imagePath?: string | null;
  sortOrder?: number | string;
  createdAt?: string;
  name?: { ar?: string; en?: string };
  arName?: string;
  enName?: string;
  isLeaf?: boolean;
  deletedAt?: string | null;
};

export type OfferApiShape = Offer;
export type CollectionApiShape = Collection;
