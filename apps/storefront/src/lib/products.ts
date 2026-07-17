import { apiGet } from "./api/client";
import type { RelatedItemCard } from "@minikoshk/shared";

/** Variant fields the storefront card actually uses (see `toStorefrontProduct`). */
export interface StorefrontVariant {
  id: number;
  sizeId: number;
  colorId: number | null;
  price: number;
  stock: number;
}

export interface StorefrontSize {
  id: number;
  label: string;
  sortOrder: number;
}

export interface StorefrontColor {
  id: number;
  hex: string;
  sortOrder: number;
}

export interface StorefrontMedia {
  type: "image" | "video";
  url: string;
}

/**
 * Shape returned by `GET /api/v1/products` — a subset of the shared `Product`
 * that the storefront renders. Bilingual name comes as a nested object.
 */
export interface StorefrontProduct {
  id: number;
  slug: string;
  name: { ar: string; en: string };
  keywords: string[];
  imagePath: string;
  hoverImagePath?: string;
  /** Original (pre-discount) price; when higher than the live price, the card shows a SAVE badge. */
  compareAtPrice?: number;
  media: StorefrontMedia[];
  status: "active" | "inactive";
  isNew: boolean;
  isBestseller: boolean;
  sizes: StorefrontSize[];
  colors: StorefrontColor[];
  variants: StorefrontVariant[];
}

/**
 * Shape returned by `GET /api/v1/products/:slug` — the list shape plus the
 * long-form bilingual copy and the resolved related-item cards.
 */
export interface StorefrontProductDetail extends StorefrontProduct {
  description: { ar: string; en: string };
  ingredients: { ar: string; en: string };
  howToUse: { ar: string; en: string };
  warnings: { ar: string; en: string };
  youtubeUrl?: string;
  relatedItems?: RelatedItemCard[];
}

export function resolveVariant(
  product: StorefrontProduct,
  sizeId: number,
  colorId: number | null
) {
  return product.variants.find((variant) =>
    variant.sizeId === sizeId && variant.colorId === colorId
  );
}

export function firstInStockVariant(product: StorefrontProduct) {
  return product.variants.find((variant) => variant.stock > 0);
}

/** Lowest variant price, or 0 when the product has no variants. */
export function productPrice(product: StorefrontProduct): number {
  if (product.variants.length === 0) {
    return 0;
  }
  return product.variants.reduce((lowest, variant) => Math.min(lowest, variant.price), Infinity);
}

/**
 * New-arrivals are the live, in-stock-priced products an admin flagged `isNew`.
 * We require an image and a price so cards never render broken.
 */
export function selectNewArrivals(products: StorefrontProduct[]): StorefrontProduct[] {
  return products.filter(
    (product) =>
      product.isNew &&
      product.status === "active" &&
      Boolean(product.imagePath) &&
      productPrice(product) > 0
  );
}

/**
 * Best-sellers are the live, in-stock-priced products an admin flagged
 * `isBestseller`. Match the new-arrivals card constraints so rendering stays
 * consistent across both sections.
 */
export function selectBestSellers(products: StorefrontProduct[]): StorefrontProduct[] {
  return products.filter(
    (product) =>
      product.isBestseller &&
      product.status === "active" &&
      Boolean(product.imagePath) &&
      productPrice(product) > 0
  );
}

/** Full catalog listing; `q` and `category` map to the API's search filters. */
export async function getProducts(filters: { q?: string; category?: string } = {}): Promise<StorefrontProduct[]> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  const query = params.toString();
  const payload = await apiGet<{ items: StorefrontProduct[] }>(`/products${query ? `?${query}` : ""}`);
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function getNewArrivals(): Promise<StorefrontProduct[]> {
  return selectNewArrivals(await getProducts());
}

export async function getBestSellers(): Promise<StorefrontProduct[]> {
  return selectBestSellers(await getProducts());
}

export async function getProductBySlug(slug: string): Promise<StorefrontProductDetail | null> {
  return apiGet<StorefrontProductDetail>(`/products/${encodeURIComponent(slug)}`);
}
