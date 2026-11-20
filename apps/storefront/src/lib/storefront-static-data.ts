import { SHOP_PAGE_BUILT_IN_BLOCK_TYPES, type Advice, type Category, type Collection, type Offer, type Product, type ShopPageBlock } from "@capella/shared";
import { fetchAdvices, fetchCategories, fetchCollections, fetchOffers, fetchProducts, fetchShopLayout } from "@/lib/api/client";

async function safeList<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

/** The built-in sections in their usual order: what the shop page shows when its layout can't be loaded. */
function defaultShopLayout(): ShopPageBlock[] {
  return SHOP_PAGE_BUILT_IN_BLOCK_TYPES.map((type, index) => ({ id: -(index + 1), type, categoryId: null, mediaSection: null, sortOrder: index + 1 }));
}

async function loadShopLayout(lang: string): Promise<ShopPageBlock[]> {
  try {
    return (await fetchShopLayout({ lang })) ?? defaultShopLayout();
  } catch {
    return defaultShopLayout();
  }
}

export async function loadShopPageData(lang: string): Promise<{
  products: Product[];
  offers: Offer[];
  collections: Collection[];
  categories: Category[];
  advices: Advice[];
  layout: ShopPageBlock[];
}> {
  const [products, offers, collections, categories, advices, layout] = await Promise.all([
    safeList(() => fetchProducts({ lang })),
    safeList(() => fetchOffers({ lang })),
    safeList(() => fetchCollections({ lang })),
    safeList(() => fetchCategories({ lang })),
    safeList(() => fetchAdvices({ lang })),
    loadShopLayout(lang)
  ]);

  return { products, offers, collections, categories, advices, layout };
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
