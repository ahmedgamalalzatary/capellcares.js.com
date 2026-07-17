import { apiGet, apiGetOr } from "./api/client";
import type { RelatedItemCard } from "@minikoshk/shared";

/**
 * Offers and collections share one storefront shape: a fixed-price bundle of
 * product variants with a computed original total and live stock.
 * Offers come from `GET /api/v1/offers`, collections from `GET /api/v1/collections`.
 */
export interface StorefrontBundle {
  id: number;
  slug: string;
  name: { ar: string; en: string };
  description: { ar: string; en: string };
  imagePath: string;
  /** The bundle's fixed selling price. */
  price: number;
  /** Sum of the included variants' individual prices — shown struck through when higher. */
  originalTotal: number;
  stock: number;
  status: "active" | "inactive";
  items: Array<{ id?: number; variantId: number; qty: number }>;
}

export interface StorefrontBundleDetail extends StorefrontBundle {
  relatedItems?: RelatedItemCard[];
}

export type BundleKind = "offer" | "collection";

/** Percentage saved against buying the items individually, or 0 when there's no discount. */
export function bundleSavePercent(bundle: StorefrontBundle): number {
  if (bundle.originalTotal <= bundle.price) {
    return 0;
  }
  return Math.round((1 - bundle.price / bundle.originalTotal) * 100);
}

async function listBundles(resource: "offers" | "collections"): Promise<StorefrontBundle[]> {
  const payload = await apiGetOr<{ items: StorefrontBundle[] }>(`/${resource}`, { items: [] });
  return Array.isArray(payload.items) ? payload.items.filter((bundle) => bundle.status === "active") : [];
}

async function getBundleBySlug(resource: "offers" | "collections", slug: string): Promise<StorefrontBundleDetail | null> {
  try {
    return await apiGet<StorefrontBundleDetail>(`/${resource}/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export const getOffers = () => listBundles("offers");
export const getOfferBySlug = (slug: string) => getBundleBySlug("offers", slug);
export const getCollections = () => listBundles("collections");
export const getCollectionBySlug = (slug: string) => getBundleBySlug("collections", slug);
