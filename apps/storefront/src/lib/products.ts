import { resolveApiBase } from "@minikoshk/shared/api/base";

const API_BASE = resolveApiBase(process.env, { isServer: true });

/** Variant fields the storefront card actually uses (see `toStorefrontProduct`). */
export interface StorefrontVariant {
  price: number;
  stock: number;
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
  media: StorefrontMedia[];
  status: "active" | "inactive";
  isNew: boolean;
  isBestseller: boolean;
  variants: StorefrontVariant[];
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

export async function getNewArrivals(): Promise<StorefrontProduct[]> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/products`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as { items?: StorefrontProduct[] };
    return Array.isArray(payload.items) ? selectNewArrivals(payload.items) : [];
  } catch {
    return [];
  }
}

export async function getBestSellers(): Promise<StorefrontProduct[]> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/products`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as { items?: StorefrontProduct[] };
    return Array.isArray(payload.items) ? selectBestSellers(payload.items) : [];
  } catch {
    return [];
  }
}
