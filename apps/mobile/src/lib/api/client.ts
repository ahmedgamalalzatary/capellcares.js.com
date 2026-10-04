import type {
  Advice,
  Category,
  CheckoutRequestDto,
  CheckoutResponseDto,
  Collection,
  Offer,
  Order,
  OrderSummary,
  Product,
  ReviewCreateInput,
  ReviewEntityType,
  ReviewPage,
  ReviewPrompt,
  ShopMediaSection,
  StorefrontCollectionDetail,
  StorefrontOfferDetail,
  StorefrontProductDetail,
  WishlistEntry,
  WishlistEntityType
} from "@capella/shared";
import { checkoutResponseSchema } from "@capella/shared";
import { ApiError, authedGetJSON, authedMutationJSON, getJSON } from "./http";
import {
  normalizeCategory,
  normalizeCollection,
  normalizeOffer,
  normalizeProduct,
  normalizeReviewPrompt,
  normalizeShopMediaSection,
  normalizeWishlistEntry
} from "./normalizers";
import {
  getCategoryById,
  getCategoryBySlug,
  getCategoryPath,
  getOffersForProduct
} from "./selectors";
import type {
  CategoryApiShape,
  CollectionApiShape,
  CollectionDetailApiShape,
  FetchLanguage,
  OfferApiShape,
  OfferDetailApiShape,
  ProductApiShape,
  ProductDetailApiShape
} from "./types";

type PublicOptions = {
  lang?: FetchLanguage;
  throwOnError?: boolean;
};

type LanguageOptions = {
  lang?: FetchLanguage;
};

type CheckoutOptions = LanguageOptions & {
  idempotencyKey: string;
};

function requireItems<T>(
  data: { items?: unknown } | null | undefined,
  label: string,
  required: boolean
): T[] {
  const items = data?.items;
  if (Array.isArray(items)) {
    return items as T[];
  }
  if (required) {
    throw new ApiError(200, `Invalid ${label} payload`, "INVALID_PAYLOAD");
  }
  return [];
}

function normalizeRows<TInput, TOutput>(
  items: TInput[],
  normalizer: (item: TInput) => TOutput,
  label: string,
  required = false
): TOutput[] {
  const normalized: TOutput[] = [];
  for (const item of items) {
    try {
      normalized.push(normalizer(item));
    } catch (error) {
      console.error(`Failed to normalize ${label} payload`, { error, [label]: item });
    }
  }
  if (required && items.length > 0 && normalized.length === 0) {
    throw new ApiError(200, `Invalid ${label} payload`, "INVALID_PAYLOAD");
  }
  return normalized;
}

export async function fetchProducts(params?: {
  q?: string;
  category?: string;
  categoryId?: string;
  lang?: FetchLanguage;
  throwOnError?: boolean;
}): Promise<Product[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.category) search.set("category", params.category);
  if (params?.categoryId) search.set("categoryId", params.categoryId);
  const query = search.toString();
  const required = params?.throwOnError === true;
  const data = await getJSON<{ items: ProductApiShape[] }>(
    `/api/v1/products${query ? `?${query}` : ""}`,
    { lang: params?.lang, throwOnError: params?.throwOnError }
  );

  return normalizeRows(
    requireItems<ProductApiShape>(data, "product", required),
    normalizeProduct,
    "product",
    required
  );
}

export async function fetchProductBySlug(
  slug: string,
  options?: PublicOptions
): Promise<Product | null> {
  const product = await getJSON<ProductApiShape>(
    `/api/v1/products/${encodeURIComponent(slug)}`,
    options
  );
  return product ? normalizeProduct(product) : null;
}

export async function fetchProductDetailBySlug(
  slug: string,
  options?: PublicOptions
): Promise<StorefrontProductDetail | null> {
  const product = await getJSON<ProductDetailApiShape>(
    `/api/v1/products/${encodeURIComponent(slug)}`,
    options
  );
  return product ? normalizeProduct(product) : null;
}

export async function fetchCategories(
  options?: PublicOptions
): Promise<Category[]> {
  const required = options?.throwOnError === true;
  const data = await getJSON<{ items: CategoryApiShape[] }>(
    "/api/v1/categories",
    options
  );
  return normalizeRows(
    requireItems<CategoryApiShape>(data, "category", required),
    normalizeCategory,
    "category",
    required
  );
}

export async function fetchOffers(options?: PublicOptions): Promise<Offer[]> {
  const required = options?.throwOnError === true;
  const data = await getJSON<{ items: OfferApiShape[] }>("/api/v1/offers", options);
  return normalizeRows(
    requireItems<OfferApiShape>(data, "offer", required),
    normalizeOffer,
    "offer",
    required
  );
}

export async function fetchCollections(
  options?: PublicOptions
): Promise<Collection[]> {
  const required = options?.throwOnError === true;
  const data = await getJSON<{ items: CollectionApiShape[] }>(
    "/api/v1/collections",
    options
  );
  return normalizeRows(
    requireItems<CollectionApiShape>(data, "collection", required),
    normalizeCollection,
    "collection",
    required
  );
}

export async function fetchOfferBySlug(
  slug: string,
  options?: PublicOptions
): Promise<Offer | null> {
  const offer = await getJSON<OfferApiShape>(
    `/api/v1/offers/${encodeURIComponent(slug)}`,
    options
  );
  return offer ? normalizeOffer(offer) : null;
}

export async function fetchOfferDetailBySlug(
  slug: string,
  options?: PublicOptions
): Promise<StorefrontOfferDetail | null> {
  const offer = await getJSON<OfferDetailApiShape>(
    `/api/v1/offers/${encodeURIComponent(slug)}`,
    options
  );
  return offer ? normalizeOffer(offer) : null;
}

export async function fetchCollectionBySlug(
  slug: string,
  options?: PublicOptions
): Promise<Collection | null> {
  const collection = await getJSON<CollectionApiShape>(
    `/api/v1/collections/${encodeURIComponent(slug)}`,
    options
  );
  return collection ? normalizeCollection(collection) : null;
}

export async function fetchCollectionDetailBySlug(
  slug: string,
  options?: PublicOptions
): Promise<StorefrontCollectionDetail | null> {
  const collection = await getJSON<CollectionDetailApiShape>(
    `/api/v1/collections/${encodeURIComponent(slug)}`,
    options
  );
  return collection ? normalizeCollection(collection) : null;
}

export async function fetchAdvices(options?: PublicOptions): Promise<Advice[]> {
  const data = await getJSON<{ items: Advice[] }>("/api/v1/advices", options);
  return data?.items ?? [];
}

export async function fetchShopMediaSections(
  options?: PublicOptions
): Promise<ShopMediaSection[]> {
  const required = options?.throwOnError === true;
  const data = await getJSON<{ items: ShopMediaSection[] }>(
    "/api/v1/shop-media-sections",
    options
  );
  return normalizeRows(
    requireItems<ShopMediaSection>(data, "shop media section", required),
    normalizeShopMediaSection,
    "shop media section",
    required
  );
}

export async function fetchCustomerOrders(
  accessToken: string,
  options?: LanguageOptions
): Promise<OrderSummary[]> {
  const data = await authedGetJSON<{ items: OrderSummary[] }>(
    "/api/v1/orders",
    accessToken,
    options
  );
  return data?.items ?? [];
}

export function fetchCustomerOrderById(
  id: number,
  accessToken: string,
  options?: LanguageOptions
): Promise<Order | null> {
  return authedGetJSON<Order>(`/api/v1/orders/${id}`, accessToken, options);
}

export function fetchPublicReviews(
  entityType: ReviewEntityType,
  entityId: number,
  page: number,
  pageSize: number,
  options?: PublicOptions
): Promise<ReviewPage | null> {
  return getJSON<ReviewPage>(
    `/api/v1/reviews/${entityType}/${entityId}?page=${page}&pageSize=${pageSize}`,
    options
  );
}

export function submitReview(
  accessToken: string,
  input: ReviewCreateInput,
  options?: LanguageOptions
): Promise<{ id: number } | null> {
  return authedMutationJSON<{ id: number }>(
    "/api/v1/reviews",
    accessToken,
    { method: "POST", body: input },
    options
  );
}

export async function claimReviewPrompt(
  accessToken: string,
  options?: LanguageOptions
): Promise<ReviewPrompt | null> {
  const prompt = await authedMutationJSON<ReviewPrompt>(
    "/api/v1/reviews/prompt/claim",
    accessToken,
    { method: "POST" },
    options
  );
  return prompt ? normalizeReviewPrompt(prompt) : null;
}

export async function fetchWishlist(
  accessToken: string,
  options?: LanguageOptions
): Promise<WishlistEntry[]> {
  const data = await authedGetJSON<{ items: WishlistEntry[] }>(
    "/api/v1/wishlist",
    accessToken,
    options
  );
  return normalizeRows(data?.items ?? [], normalizeWishlistEntry, "wishlist entry");
}

export function addWishlistItem(
  accessToken: string,
  entityType: WishlistEntityType,
  entityId: number,
  options?: LanguageOptions
): Promise<{ ok: boolean } | null> {
  return authedMutationJSON<{ ok: boolean }>(
    "/api/v1/wishlist",
    accessToken,
    { method: "POST", body: { entityType, entityId } },
    options
  );
}

export function removeWishlistItem(
  accessToken: string,
  entityType: WishlistEntityType,
  entityId: number,
  options?: LanguageOptions
): Promise<{ ok: boolean } | null> {
  return authedMutationJSON<{ ok: boolean }>(
    `/api/v1/wishlist/${entityType}/${entityId}`,
    accessToken,
    { method: "DELETE" },
    options
  );
}

export async function submitCheckout(
  input: CheckoutRequestDto,
  accessToken: string | null,
  options: CheckoutOptions
): Promise<CheckoutResponseDto> {
  const data = await authedMutationJSON<unknown>(
    "/api/v1/checkout",
    accessToken,
    { method: "POST", body: input, idempotencyKey: options.idempotencyKey },
    options
  );
  const result = checkoutResponseSchema.safeParse(data);
  if (!result.success) {
    throw new ApiError(200, "Invalid checkout response", "INVALID_CHECKOUT_RESPONSE");
  }
  return result.data;
}

export {
  getCategoryById,
  getCategoryBySlug,
  getCategoryPath,
  getOffersForProduct
};
