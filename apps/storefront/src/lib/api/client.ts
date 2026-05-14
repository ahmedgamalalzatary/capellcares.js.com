import type { Product, Category, Offer } from "@capella/shared";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) return null as T;
    throw new Error(`API ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchProducts(params?: { q?: string; category?: string }): Promise<Product[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.category) search.set("category", params.category);
  const qs = search.toString();
  const data = await getJSON<{ items: Product[] }>(`/api/v1/products${qs ? `?${qs}` : ""}`);
  return data?.items ?? [];
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  return getJSON<Product>(`/api/v1/products/${encodeURIComponent(slug)}`);
}

export async function fetchCategories(): Promise<Category[]> {
  const data = await getJSON<{ items: Category[] }>(`/api/v1/categories`);
  return data?.items ?? [];
}

export async function fetchOffers(): Promise<Offer[]> {
  const data = await getJSON<{ items: Offer[] }>(`/api/v1/offers`);
  return data?.items ?? [];
}

export async function fetchOfferBySlug(slug: string): Promise<Offer | null> {
  return getJSON<Offer>(`/api/v1/offers/${encodeURIComponent(slug)}`);
}

// helpers (computed client-side after fetching)
export function getCategoryById(categories: Category[], id: number): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getCategoryBySlug(categories: Category[], slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug && !c.deletedAt);
}

export function getCategoryPath(categories: Category[], id: number): Category[] {
  const path: Category[] = [];
  let current = getCategoryById(categories, id);
  while (current) {
    path.unshift(current);
    current = current.parentId != null ? getCategoryById(categories, current.parentId) : undefined;
  }
  return path;
}

export function getDescendantCategoryIds(categories: Category[], rootId: number): number[] {
  const set = new Set<number>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) {
      if (c.parentId != null && set.has(c.parentId) && !set.has(c.id)) {
        set.add(c.id);
        changed = true;
      }
    }
  }
  return Array.from(set);
}

export function getProductsByCategory(products: Product[], categories: Category[], categoryId: number): Product[] {
  const ids = new Set(getDescendantCategoryIds(categories, categoryId));
  return products.filter((p) => ids.has(p.categoryId));
}

export function getOffersForProduct(offers: Offer[], products: Product[], productId: number): Offer[] {
  const product = products.find((p) => p.id === productId);
  if (!product) return [];
  const variantIds = new Set(product.variants.map((v) => v.id));
  return offers.filter((o) => o.items.some((it) => variantIds.has(it.variantId)));
}
