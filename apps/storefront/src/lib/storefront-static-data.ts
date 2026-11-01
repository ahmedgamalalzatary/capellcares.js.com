import type { Advice, Category, Collection, Offer, Product, ProductAttribute, ShopMediaSection } from "@capella/shared";
import { fetchAdvices, fetchBrands, fetchCategories, fetchCollections, fetchGenders, fetchOffers, fetchProducts, fetchShopMediaSections } from "@/lib/api/client";

async function safeList<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

export async function loadShopPageData(lang: string): Promise<{
  categories: Category[];
  brands: ProductAttribute[];
  genders: ProductAttribute[];
  advices: Advice[];
  shopMediaSections: ShopMediaSection[];
}> {
  const [categories, brands, genders, advices, shopMediaSections] = await Promise.all([
    safeList(() => fetchCategories({ lang })),
    safeList(() => fetchBrands({ lang })),
    safeList(() => fetchGenders({ lang })),
    safeList(() => fetchAdvices({ lang })),
    safeList(() => fetchShopMediaSections({ lang }))
  ]);

  return { categories, brands, genders, advices, shopMediaSections };
}

export async function loadSitemapData(): Promise<{
  products: Product[];
  categories: Category[];
  offers: Offer[];
  collections: Collection[];
  brands: ProductAttribute[];
  genders: ProductAttribute[];
}> {
  const [products, categories, offers, collections, brands, genders] = await Promise.all([
    safeList(() => fetchProducts()),
    safeList(() => fetchCategories()),
    safeList(() => fetchOffers()),
    safeList(() => fetchCollections()),
    safeList(() => fetchBrands()),
    safeList(() => fetchGenders())
  ]);

  return { products, categories, offers, collections, brands, genders };
}
