import { SHOP_PAGE_DEFAULT_BLOCK_TYPES, type Advice, type Category, type Collection, type Offer, type Product, type ProductAttribute, type ShopPageBlock } from "@capella/shared";
import { fetchAdvices, fetchBrands, fetchCategories, fetchCollections, fetchGenders, fetchOffers, fetchProducts, fetchShopLayout } from "@/lib/api/client";

async function safeList<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

/** The built-in sections in their usual order: what the shop page shows when its layout can't be loaded. */
function defaultShopLayout(): ShopPageBlock[] {
  return SHOP_PAGE_DEFAULT_BLOCK_TYPES.map((type, index) => ({ id: -(index + 1), type, categoryId: null, mediaSection: null, sortOrder: index + 1 }));
}

async function loadShopLayout(lang: string): Promise<ShopPageBlock[]> {
  try {
    return (await fetchShopLayout({ lang })) ?? defaultShopLayout();
  } catch {
    return defaultShopLayout();
  }
}

export async function loadShopPageData(lang: string): Promise<{
  categories: Category[];
  brands: ProductAttribute[];
  genders: ProductAttribute[];
  advices: Advice[];
  products: Product[];
  offers: Offer[];
  collections: Collection[];
  layout: ShopPageBlock[];
}> {
  const [categories, brands, genders, advices, products, offers, layout] = await Promise.all([
    safeList(() => fetchCategories({ lang })),
    safeList(() => fetchBrands({ lang })),
    safeList(() => fetchGenders({ lang })),
    safeList(() => fetchAdvices({ lang })),
    safeList(() => fetchProducts({ lang })),
    safeList(() => fetchOffers({ lang })),
    loadShopLayout(lang)
  ]);
  // Collections is not on the page unless the ERP added it, so it is only fetched then.
  const collections = layout.some((block) => block.type === "collections") ? await safeList(() => fetchCollections({ lang })) : [];

  return { categories, brands, genders, advices, products, offers, collections, layout };
}

/** The all categories page: every category; the page itself keeps the main ones that have a picture. */
export async function loadCategoriesPageData(lang: string): Promise<Category[]> {
  return safeList(() => fetchCategories({ lang }));
}

/** The all brands page: every brand; the page itself keeps the ones that have products. */
export async function loadBrandsPageData(lang: string): Promise<ProductAttribute[]> {
  return safeList(() => fetchBrands({ lang }));
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
