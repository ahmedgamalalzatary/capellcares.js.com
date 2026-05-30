import type {
  Advice,
  Category,
  Offer,
  Order,
  OrderSummary,
  Product,
  RelatedItemCard,
  StorefrontOfferDetail,
  StorefrontProductDetail
} from "@capella/shared";
import { resolveApiBase } from "@capella/shared/api/base";

export const API_BASE = resolveApiBase();
type FetchLanguage = "ar" | "en";
type ProductApiShape = Product & {
  media?: Array<{ type: "image" | "video"; url: string }>;
  imagePath?: string | null;
  hoverImagePath?: string | null;
};

type ProductDetailApiShape = Omit<ProductApiShape, "relatedItems"> & {
  relatedItems?: RelatedItemCard[];
};

type OfferDetailApiShape = Omit<Offer, "relatedItems"> & {
  relatedItems?: RelatedItemCard[];
};

type CategoryApiShape = {
  id: number;
  parentId: number | null;
  slug: string;
  name?: { ar?: string; en?: string };
  arName?: string;
  enName?: string;
  isLeaf?: boolean;
  deletedAt?: string | null;
};

function normalizeCategory(input: CategoryApiShape): Category {
  return {
    id: Number(input.id),
    parentId: input.parentId == null ? null : Number(input.parentId),
    slug: input.slug,
    name: {
      ar: input.name?.ar ?? input.arName ?? "",
      en: input.name?.en ?? input.enName ?? ""
    },
    isLeaf: Boolean(input.isLeaf ?? true),
    deletedAt: input.deletedAt ?? null
  };
}

function resolveFetchLanguage(lang?: string): FetchLanguage | undefined {
  if (lang === "ar" || lang === "en") {
    return lang;
  }

  if (typeof document !== "undefined") {
    const documentLang = document.documentElement.lang;
    if (documentLang === "ar" || documentLang === "en") {
      return documentLang;
    }
  }

  return undefined;
}

function resolveMediaUrl(url: string | null | undefined): string {
  const value = url?.trim() ?? "";
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${API_BASE}${value}`;
  }

  return value;
}

function isConnectionFailure(error: unknown): boolean {
  return error instanceof TypeError;
}

async function getJSON<T>(path: string, options?: { lang?: string }): Promise<T> {
  const resolvedLang = resolveFetchLanguage(options?.lang);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 300 },
      headers: resolvedLang ? { "x-lang": resolvedLang } : undefined
    });
  } catch (error) {
    if (isConnectionFailure(error)) {
      return null as T;
    }
    throw error;
  }
  if (!res.ok) {
    if (res.status === 404) return null as T;
    throw new Error(`API ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

function normalizeProduct<T extends ProductApiShape>(product: T): T {
  const normalizedImagePath = resolveMediaUrl(product.imagePath ?? "");
  const media = product.media?.length
    ? product.media.map((item) => ({ ...item, url: resolveMediaUrl(item.url) }))
    : normalizedImagePath
      ? [{ type: "image" as const, url: normalizedImagePath }]
      : [];

  return {
    ...product,
    imagePath: normalizedImagePath || (media.find((item) => item.type === "image")?.url ?? ""),
    hoverImagePath: resolveMediaUrl(product.hoverImagePath ?? ""),
    media
  };
}

export async function fetchProducts(params?: { q?: string; category?: string; lang?: string }): Promise<Product[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.category) search.set("category", params.category);
  const qs = search.toString();
  const data = await getJSON<{ items: ProductApiShape[] }>(`/api/v1/products${qs ? `?${qs}` : ""}`, {
    lang: params?.lang
  });
  return (data?.items ?? []).map(normalizeProduct);
}

export async function fetchProductBySlug(slug: string, options?: { lang?: string }): Promise<Product | null> {
  const product = await getJSON<ProductApiShape>(`/api/v1/products/${encodeURIComponent(slug)}`, options);
  return product ? normalizeProduct(product) : null;
}

export async function fetchProductDetailBySlug(
  slug: string,
  options?: { lang?: string }
): Promise<StorefrontProductDetail | null> {
  const product = await getJSON<ProductDetailApiShape>(`/api/v1/products/${encodeURIComponent(slug)}`, options);
  return product ? normalizeProduct(product) : null;
}

export async function fetchCategories(options?: { lang?: string }): Promise<Category[]> {
  const data = await getJSON<{ items: CategoryApiShape[] }>(`/api/v1/categories`, options);
  return (data?.items ?? []).map(normalizeCategory);
}

export async function fetchOffers(options?: { lang?: string }): Promise<Offer[]> {
  const data = await getJSON<{ items: Offer[] }>(`/api/v1/offers`, options);
  return data?.items ?? [];
}

export async function fetchOfferBySlug(slug: string, options?: { lang?: string }): Promise<Offer | null> {
  return getJSON<Offer>(`/api/v1/offers/${encodeURIComponent(slug)}`, options);
}

export async function fetchOfferDetailBySlug(
  slug: string,
  options?: { lang?: string }
): Promise<StorefrontOfferDetail | null> {
  return getJSON<OfferDetailApiShape>(`/api/v1/offers/${encodeURIComponent(slug)}`, options);
}

export async function fetchAdvices(options?: { lang?: string }): Promise<Advice[]> {
  const data = await getJSON<{ items: Advice[] }>(`/api/v1/advices`, options);
  return data?.items ?? [];
}

async function authedGetJSON<T>(path: string, accessToken: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });
  } catch (error) {
    if (isConnectionFailure(error)) {
      return null as T;
    }
    throw error;
  }
  if (!res.ok) {
    if (res.status === 404) return null as T;
    throw new Error(`API ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchCustomerOrders(accessToken: string): Promise<OrderSummary[]> {
  const data = await authedGetJSON<{ items: OrderSummary[] }>(`/api/v1/orders`, accessToken);
  return data?.items ?? [];
}

export async function fetchCustomerOrderById(id: number, accessToken: string): Promise<Order | null> {
  return authedGetJSON<Order>(`/api/v1/orders/${id}`, accessToken);
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
