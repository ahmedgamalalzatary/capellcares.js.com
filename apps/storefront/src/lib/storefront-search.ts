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

function matchesBilingual(name: { ar: string; en: string }, query: string) {
  const normalizedQuery = query.toLowerCase();
  return name.ar.toLowerCase().includes(normalizedQuery) || name.en.toLowerCase().includes(normalizedQuery);
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
      .filter((category) => !category.deletedAt && matchesBilingual(category.name, normalizedQuery))
      .slice(0, 4),
    offers: allOffers
      .filter(
        (offer) =>
          !offer.deletedAt &&
          offer.status === "active" &&
          matchesBilingual(offer.name, normalizedQuery)
      )
      .slice(0, 3),
    collections: allCollections
      .filter(
        (collection) =>
          !collection.deletedAt &&
          collection.status === "active" &&
          collection.visibility === "visible" &&
          matchesBilingual(collection.name, normalizedQuery)
      )
      .slice(0, 3)
  };
}
