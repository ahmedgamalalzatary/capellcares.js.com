import type { Advice, Category, Offer, Product } from "@capella/shared";
import { fetchAdvices, fetchCategories, fetchOffers, fetchProducts } from "@/lib/api/client";

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
  advices: Advice[];
}> {
  const [products, offers, advices] = await Promise.all([
    safeList(() => fetchProducts({ lang })),
    safeList(() => fetchOffers({ lang })),
    safeList(() => fetchAdvices({ lang }))
  ]);

  return { products, offers, advices };
}

export async function loadSitemapData(): Promise<{
  products: Product[];
  categories: Category[];
  offers: Offer[];
}> {
  const [products, categories, offers] = await Promise.all([
    safeList(() => fetchProducts()),
    safeList(() => fetchCategories()),
    safeList(() => fetchOffers())
  ]);

  return { products, categories, offers };
}
