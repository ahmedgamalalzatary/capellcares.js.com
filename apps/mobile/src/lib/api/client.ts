import type {
  Advice,
  Category,
  CheckoutRequestDto,
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
import { authedGetJSON, authedMutationJSON, getJSON } from "./http";
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
  const data = await getJSON<{ items: ProductApiShape[] }>(
    `/api/v1/products${query ? `?${query}` : ""}`,
    { lang: params?.lang, throwOnError: params?.throwOnError }
  );

  return (data?.items ?? [])
    .map((item) => {
      try {
        return normalizeProduct(item);
      } catch (error) {
        console.error("Failed to normalize product payload", { error, product: item });
        return null;
      }
    })
    .filter((item): item is Product => item != null);
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
  const data = await getJSON<{ items: CategoryApiShape[] }>(
    "/api/v1/categories",
    options
  );
  return (data?.items ?? []).map(normalizeCategory);
}

export async function fetchOffers(options?: PublicOptions): Promise<Offer[]> {
  const data = await getJSON<{ items: OfferApiShape[] }>("/api/v1/offers", options);
  return (data?.items ?? []).map(normalizeOffer);
}

export async function fetchCollections(
  options?: PublicOptions
): Promise<Collection[]> {
  const data = await getJSON<{ items: CollectionApiShape[] }>(
    "/api/v1/collections",
    options
  );
  return (data?.items ?? []).map(normalizeCollection);
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
  const data = await getJSON<{ items: ShopMediaSection[] }>(
    "/api/v1/shop-media-sections",
    options
  );
  return (data?.items ?? []).map(normalizeShopMediaSection);
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
  return (data?.items ?? []).map(normalizeWishlistEntry);
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

export function submitCheckout(
  input: CheckoutRequestDto,
  accessToken: string | null = null,
  options?: LanguageOptions
): Promise<Pick<Order, "id" | "orderCode" | "paymentStatus"> | null> {
  return authedMutationJSON<Pick<Order, "id" | "orderCode" | "paymentStatus">>(
    "/api/v1/checkout",
    accessToken,
    { method: "POST", body: input },
    { ...options, retryOn401: false }
  );
}

export {
  getCategoryById,
  getCategoryBySlug,
  getCategoryPath,
  getOffersForProduct
};
