import type { Category, Collection, Language, Offer, Product } from "@capella/shared";
import { fetchCategories, fetchCollections, fetchOffers, fetchProducts } from "./api/client";

export type StorefrontSearchResults = {
  products: Product[];
  categories: Category[];
  offers: Offer[];
  collections: Collection[];
};

export const EMPTY_STOREFRONT_SEARCH_RESULTS: StorefrontSearchResults = {
  products: [],
  categories: [],
  offers: [],
  collections: []
};

/**
 * "Does this named thing match what the shopper typed", across both languages —
 * a bundle is routinely named in one language and searched for in the other.
 *
 * The header dropdown and the /search results page both go through this, so the
 * dropdown can never preview a match the results page then fails to find. Only
 * products differ: their matching also spans keywords and happens in the API,
 * so both surfaces ask the catalog for the term instead (see matchesProductQuery).
 */
export function matchesBilingualName(name: { ar: string; en: string }, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return name.ar.toLowerCase().includes(normalizedQuery) || name.en.toLowerCase().includes(normalizedQuery);
}

/** An offer/collection is searchable only while a shopper could actually buy it. */
export function isSearchableBundle(bundle: {
  deletedAt?: string | null;
  status: string;
  visibility?: string;
}) {
  return !bundle.deletedAt && bundle.status === "active" && bundle.visibility !== "hidden";
}

export async function searchStorefront(query: string, lang: Language): Promise<StorefrontSearchResults> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return EMPTY_STOREFRONT_SEARCH_RESULTS;

  const [products, allCategories, allOffers, allCollections] = await Promise.all([
    fetchProducts({ q: normalizedQuery, lang, throwOnError: true }),
    fetchCategories({ lang, throwOnError: true }),
    fetchOffers({ lang, throwOnError: true }),
    fetchCollections({ lang, throwOnError: true })
  ]);

  return {
    products: products.slice(0, 5),
    categories: allCategories
      .filter((category) => !category.deletedAt && matchesBilingualName(category.name, normalizedQuery))
      .slice(0, 4),
    offers: allOffers
      .filter((offer) => isSearchableBundle(offer) && matchesBilingualName(offer.name, normalizedQuery))
      .slice(0, 3),
    collections: allCollections
      .filter((collection) => isSearchableBundle(collection) && matchesBilingualName(collection.name, normalizedQuery))
      .slice(0, 3)
  };
}
