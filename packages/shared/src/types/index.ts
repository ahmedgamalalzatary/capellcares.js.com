import type { Language } from "../constants/languages.js";
import type { ProductStatus } from "../constants/product-status.js";
import type { PaymentMethod } from "../constants/payment-methods.js";

export type { Assert, IsEqual } from "./assert-type-equal.js";

export type Bilingual = { ar: string; en: string };
export type PaymentStatus = "pending" | "accepted" | "denied";

export interface Category {
  id: number;
  parentId: number | null;
  slug: string;
  name: Bilingual;
  imagePath?: string | null;
  sortOrder?: number;
  isLeaf: boolean;
  createdAt?: string;
  deletedAt?: string | null;
}

/** One rank of an entity inside one ordering scope (see entity_orderings). */
export interface EntityOrderingRef {
  scopeType: "root" | "category" | "offer" | "collection";
  scopeId: number | null;
  rank: number;
}

export interface ProductVariant {
  id: number;
  productId: number;
  size: string;
  price: number;
  stock: number;
  sortOrder?: number;
  discount?: VariantDiscount | null;
}

export interface VariantDiscount {
  id?: number;
  variantId?: number;
  type: "percentage" | "fixed";
  value: number;
  startsAt: string;
  endsAt: string;
  status: "active" | "inactive";
}

export interface EntityMedia {
  type: "image" | "video";
  url: string;
}

/** @deprecated Use EntityMedia. */
export type ProductMedia = EntityMedia;

export interface Product {
  id: number;
  sku: string;
  slug: string;
  name: Bilingual;
  description: Bilingual;
  ingredients: Bilingual;
  howToUse: Bilingual;
  warnings: Bilingual;
  keywords: string[];
  buyingPrice: number;
  imagePath: string;
  hoverImagePath?: string;
  media?: EntityMedia[];
  youtubeUrl?: string;
  status: ProductStatus;
  isNew: boolean;
  isBestseller: boolean;
  categoryId: number;
  variants: ProductVariant[];
  /** Present on storefront payloads only; the ERP never reads reviews here. */
  rating?: RatingSummary;
  offerIds?: number[];
  relatedItems?: RelatedItemRef[];
  sortOrder?: number;
  orderings?: EntityOrderingRef[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type RelatedItemType = "product" | "offer" | "collection";
export type WishlistEntityType = RelatedItemType;
export type ReviewEntityType = RelatedItemType;
export type ReviewStatus = "active" | "inactive";

export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}

/**
 * The compact rating a card shows: just enough to draw the stars and the
 * count. Listing endpoints carry it for every item, so a grid never has to
 * fetch reviews per card; `count: 0` means nothing is shown.
 */
export interface RatingSummary {
  average: number;
  count: number;
}

export interface PublicReview {
  id: number;
  firstName: string;
  rating: number;
  comment: string;
  createdAt: string;
  verifiedPurchase: true;
}

export interface ReviewPage {
  summary: ReviewSummary;
  items: PublicReview[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ReviewCreateInput {
  entityType: ReviewEntityType;
  entityId: number;
  rating: number;
  comment: string;
}

export interface ReviewPrompt {
  entityType: ReviewEntityType;
  entityId: number;
  name: Bilingual;
  imagePath: string | null;
  href: string;
}

export interface OrderItemReview {
  entityType: ReviewEntityType;
  entityId: number;
  state: "eligible" | "submitted" | "unavailable";
}

export interface AdminReview {
  id: number;
  customerName: string;
  customerEmail: string;
  entityType: ReviewEntityType;
  entityId: number;
  entityName: Bilingual;
  orderId: number;
  orderCode: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  deletedAt: string | null;
  createdAt: string;
}

export interface AdminReviewPage {
  items: AdminReview[];
  pagination: ReviewPage["pagination"];
}

export interface WishlistEntry {
  entityType: WishlistEntityType;
  entityId: number;
  name: Bilingual;
  imagePath: string | null;
  href: string | null;
  availability: "available" | "unavailable";
}

export interface RelatedItemRef {
  type: RelatedItemType;
  id: number;
}

export interface RelatedItemCard {
  type: RelatedItemType;
  id: number;
  slug: string;
  name: Bilingual;
  imagePath: string | null;
  price: number;
  /**
   * The variant the card adds to the cart — the cheapest in-stock one. Null for
   * offers and collections, which the cart addresses by their own id.
   */
  variantId: number | null;
  /**
   * Price before the saving: a product's pre-discount selling price, or a
   * bundle's sum of parts. Null when the card is not discounted.
   */
  originalTotal: number | null;
  /**
   * Classification line shown under a product's name. Null for offers and
   * collections, whose cards carry no category line.
   */
  categoryName: Bilingual | null;
  /** Average stars and review count for the card; zeroed when unreviewed. */
  rating: RatingSummary;
}

export interface CollectionItem {
  id?: number;
  variantId: number;
  qty: number;
}

export interface Collection {
  id: number;
  slug: string;
  name: Bilingual;
  description: Bilingual;
  imagePath: string;
  media?: EntityMedia[];
  price: number;
  originalTotal: number;
  categoryId: number;
  items: CollectionItem[];
  stock: number;
  /** Present on storefront payloads only; the ERP never reads reviews here. */
  rating?: RatingSummary;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  relatedItems?: RelatedItemRef[];
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type StorefrontProductDetail = Omit<Product, "relatedItems"> & {
  relatedItems?: RelatedItemCard[];
  reviewData: ReviewPage | null;
};

export type StorefrontOfferDetail = Omit<Offer, "relatedItems"> & {
  relatedItems?: RelatedItemCard[];
  reviewData: ReviewPage | null;
};

export type StorefrontCollectionDetail = Omit<Collection, "relatedItems"> & {
  relatedItems?: RelatedItemCard[];
  reviewData: ReviewPage | null;
};

export interface OfferItem {
  id?: number;
  variantId: number;
  qty: number;
}

export interface Offer {
  id: number;
  slug: string;
  name: Bilingual;
  description: Bilingual;
  imagePath: string;
  media?: EntityMedia[];
  price: number;
  originalTotal: number;
  /**
   * The root category this offer is classified under, mirroring collections.
   * Null only for offers created before classification existed; those are
   * deactivated by the migration and must be given a category before saving.
   */
  categoryId: number | null;
  items: OfferItem[];
  stock: number;
  /** Present on storefront payloads only; the ERP never reads reviews here. */
  rating?: RatingSummary;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  relatedItems?: RelatedItemRef[];
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
}

export interface Advice {
  id: number;
  title: Bilingual;
  description: Bilingual;
  videoUrl: string;
  status: "active" | "inactive";
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export type ShopMediaTargetType =
  | "shop"
  | "new"
  | "bestsellers"
  | "products"
  | "product"
  | "offers"
  | "offer"
  | "collections"
  | "collection"
  | "category";

export interface ShopMediaSectionItem {
  id: number;
  imagePath: string | null;
  mobileImagePath: string | null;
  targetType: ShopMediaTargetType;
  targetId: number | null;
  targetSlug?: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShopMediaSection {
  id: number;
  slot: 1 | 2 | 3 | 4 | 5;
  status: "active" | "inactive";
  items: ShopMediaSectionItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  itemType: "product_variant" | "offer" | "collection";
  variantId: number | null;
  offerId: number | null;
  collectionId: number | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  snapshotNameAr: string | null;
  snapshotNameEn: string | null;
  snapshotSizeLabel: string | null;
  snapshotBaseUnitPrice?: number | null;
  snapshotDiscountId?: number | null;
  snapshotDiscountType?: "percentage" | "fixed" | null;
  snapshotDiscountValue?: number | null;
  snapshotDiscountStartsAt?: string | null;
  snapshotDiscountEndsAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  review?: OrderItemReview | null;
}

export interface OrderSummary {
  id: number;
  orderCode: string;
  customerType: "guest" | "registered";
  customerId: number | null;
  fullName: string;
  phone: string;
  email: string;
  governorate: string;
  cityArea: string;
  addressLine: string;
  buildingApartment: string;
  notes: string | null;
  paymentMethod: "cod";
  paymentStatus: PaymentStatus;
  totalAmount: number;
  createdAt: string;
}

export interface Order extends OrderSummary {
  items: OrderItem[];
}

export interface CartLineProduct {
  type: "product";
  productId: number;
  variantId: number;
  qty: number;
}
export interface CartLineOffer {
  type: "offer";
  offerId: number;
  qty: number;
}
export interface CartLineCollection {
  type: "collection";
  collectionId: number;
  qty: number;
}
export type CartLine = CartLineProduct | CartLineOffer | CartLineCollection;

export interface CheckoutForm {
  fullName: string;
  phone: string;
  email: string;
  governorate: string;
  cityArea: string;
  addressLine: string;
  buildingApartment: string;
  notes?: string;
  paymentMethod: PaymentMethod;
}

export type { Language, ProductStatus, PaymentMethod };

export function pickLang(b: Bilingual, lang: Language): string {
  if (lang === "en") return b.en?.trim() || b.ar;
  return b.ar?.trim() || b.en;
}

export function getProductBadgeState(product: Pick<Product, "isNew" | "isBestseller" | "offerIds" | "variants">) {
  return {
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    isOffer: (product.offerIds?.length ?? 0) > 0,
    isOutOfStock: product.variants.every((variant) => variant.stock === 0)
  };
}

export function getEffectiveVariantPrice(
  variant: Pick<ProductVariant, "price" | "discount">,
  now: Date = new Date()
) {
  const discount = variant.discount;
  if (!discount || discount.status !== "active") {
    return variant.price;
  }

  const startsAt = new Date(discount.startsAt);
  const endsAt = new Date(discount.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || now < startsAt || now > endsAt) {
    return variant.price;
  }

  const nextPrice = discount.type === "percentage"
    ? variant.price * (1 - discount.value / 100)
    : variant.price - discount.value;

  return Math.max(0, Number(nextPrice.toFixed(2)));
}
