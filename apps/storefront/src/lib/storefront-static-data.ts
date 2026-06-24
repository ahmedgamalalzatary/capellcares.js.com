import type { Advice, Category, Collection, Offer, Product } from "@capella/shared";
import { fetchAdvices, fetchCategories, fetchCollections, fetchOffers, fetchProducts } from "@/lib/api/client";

async function safeList<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

export async function loadShopPageData(lang: string): Promise<{
  products: Product[];
  offers: Offer[];
  collections: Collection[];
  advices: Advice[];
  categories: Category[];
}> {
  const [products, offers, collections, advices, categories] = await Promise.all([
    safeList(() => fetchProducts({ lang })),
    safeList(() => fetchOffers({ lang })),
    safeList(() => fetchCollections({ lang })),
    safeList(() => fetchAdvices({ lang })),
    safeList(() => fetchCategories({ lang }))
  ]);

  return { products, offers, collections, advices, categories };
}

export async function loadSitemapData(): Promise<{
  products: Product[];
  categories: Category[];
  offers: Offer[];
  collections: Collection[];
}> {
  const [products, categories, offers, collections] = await Promise.all([
    safeList(() => fetchProducts()),
    safeList(() => fetchCategories()),
    safeList(() => fetchOffers()),
    safeList(() => fetchCollections())
  ]);

  return { products, categories, offers, collections };
}
