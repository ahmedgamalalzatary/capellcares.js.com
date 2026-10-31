import type { Advice, Category, Collection, Offer, Product, ProductAttribute, ShopMediaSection } from "@capella/shared";
import { fetchAdvices, fetchCategories, fetchCollections, fetchGenders, fetchOffers, fetchProducts, fetchShopMediaSections } from "@/lib/api/client";

async function safeList<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

export async function loadShopPageData(lang: string): Promise<{
  categories: Category[];
  genders: ProductAttribute[];
  advices: Advice[];
  shopMediaSections: ShopMediaSection[];
}> {
  const [categories, genders, advices, shopMediaSections] = await Promise.all([
    safeList(() => fetchCategories({ lang })),
    safeList(() => fetchGenders({ lang })),
    safeList(() => fetchAdvices({ lang })),
    safeList(() => fetchShopMediaSections({ lang }))
  ]);

  return { categories, genders, advices, shopMediaSections };
}

export async function loadSitemapData(): Promise<{
  products: Product[];
  categories: Category[];
  offers: Offer[];
  collections: Collection[];
  genders: ProductAttribute[];
}> {
  const [products, categories, offers, collections, genders] = await Promise.all([
    safeList(() => fetchProducts()),
    safeList(() => fetchCategories()),
    safeList(() => fetchOffers()),
    safeList(() => fetchCollections()),
    safeList(() => fetchGenders())
  ]);

  return { products, categories, offers, collections, genders };
}
