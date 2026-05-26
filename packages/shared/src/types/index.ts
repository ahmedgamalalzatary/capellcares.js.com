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
  isLeaf: boolean;
  deletedAt?: string | null;
}

export interface ProductVariant {
  id: number;
  productId: number;
  size: string;
  price: number;
  stock: number;
  sortOrder?: number;
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
  youtubeUrl?: string;
  status: ProductStatus;
  isNew: boolean;
  isBestseller: boolean;
  categoryId: number;
  variants: ProductVariant[];
  offerIds?: number[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface OfferItem {
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
  imagePath: string | null;
  videoUrl?: string | null;
  status: "active" | "inactive";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  itemType: "product_variant" | "offer";
  variantId: number | null;
  offerId: number | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  snapshotNameAr: string | null;
  snapshotNameEn: string | null;
  snapshotSizeLabel: string | null;
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
export type CartLine = CartLineProduct | CartLineOffer;

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
