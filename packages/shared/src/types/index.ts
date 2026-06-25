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

export interface ProductMedia {
  type: "image" | "video";
  url: string;
}

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
  media?: ProductMedia[];
  youtubeUrl?: string;
  status: ProductStatus;
  isNew: boolean;
  isBestseller: boolean;
  categoryId: number;
  variants: ProductVariant[];
  offerIds?: number[];
  relatedItems?: RelatedItemRef[];
  sortOrder?: number;
  orderings?: EntityOrderingRef[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type RelatedItemType = "product" | "offer" | "collection";

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
  price: number;
  originalTotal: number;
  categoryId: number;
  items: CollectionItem[];
  stock: number;
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
};

export type StorefrontOfferDetail = Omit<Offer, "relatedItems"> & {
  relatedItems?: RelatedItemCard[];
};

export type StorefrontCollectionDetail = Omit<Collection, "relatedItems"> & {
  relatedItems?: RelatedItemCard[];
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
  price: number;
  originalTotal: number;
  items: OfferItem[];
  stock: number;
  status: "active" | "inactive";
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
  sortOrder: number;
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
