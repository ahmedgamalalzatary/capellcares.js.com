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
  ReviewEntityType,
  ReviewCreateInput,
  ReviewPrompt,
  ReviewPage,
  ShopMediaSection,
  StorefrontCollectionDetail,
  StorefrontOfferDetail,
  StorefrontProductDetail
} from "@capella/shared";
import { API_BASE, authedGetJSON, authedMutationJSON, getJSON } from "./client/http";
import { getAuthSessionRevision, refreshAccessTokenOrNull } from "../auth-provider.api";
import { normalizeCategory, normalizeProduct } from "./client/normalizers";
import {
  getCategoryById,
  getCategoryBySlug,
  getCategoryPath,
  getOffersForProduct
} from "./client/selectors";
import type {
  CategoryApiShape,
  CollectionDetailApiShape,
  OfferDetailApiShape,
  ProductApiShape,
  ProductDetailApiShape
} from "./client/types";

export async function fetchProducts(params?: { q?: string; category?: string; categoryId?: string; lang?: string; throwOnError?: boolean }): Promise<Product[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.category) search.set("category", params.category);
  if (params?.categoryId) search.set("categoryId", params.categoryId);
  const qs = search.toString();
  const data = await getJSON<{ items: ProductApiShape[] }>(`/api/v1/products${qs ? `?${qs}` : ""}`, {
    lang: params?.lang,
    throwOnError: params?.throwOnError
  });
  return (data?.items ?? [])
    .map((product) => {
      try {
        return normalizeProduct(product);
      } catch (error) {
        console.error("Failed to normalize product payload", { error, product });
        return null;
      }
    })
    .filter((product): product is Product => product != null);
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

export async function fetchCategories(options?: { lang?: string; throwOnError?: boolean }): Promise<Category[]> {
  const data = await getJSON<{ items: CategoryApiShape[] }>(`/api/v1/categories`, options);
  return (data?.items ?? []).map(normalizeCategory);
}

export async function fetchOffers(options?: { lang?: string; throwOnError?: boolean }): Promise<Offer[]> {
  const data = await getJSON<{ items: Offer[] }>(`/api/v1/offers`, options);
  return data?.items ?? [];
}

export async function fetchCollections(options?: { lang?: string; throwOnError?: boolean }): Promise<Collection[]> {
  const data = await getJSON<{ items: Collection[] }>(`/api/v1/collections`, options);
  return data?.items ?? [];
}

export async function fetchOfferBySlug(slug: string, options?: { lang?: string }): Promise<Offer | null> {
  return getJSON<Offer>(`/api/v1/offers/${encodeURIComponent(slug)}`, options);
}

export async function fetchCollectionBySlug(slug: string, options?: { lang?: string }): Promise<Collection | null> {
  return getJSON<Collection>(`/api/v1/collections/${encodeURIComponent(slug)}`, options);
}

export async function fetchOfferDetailBySlug(
  slug: string,
  options?: { lang?: string }
): Promise<StorefrontOfferDetail | null> {
  return getJSON<OfferDetailApiShape>(`/api/v1/offers/${encodeURIComponent(slug)}`, options);
}

export async function fetchCollectionDetailBySlug(
  slug: string,
  options?: { lang?: string }
): Promise<StorefrontCollectionDetail | null> {
  return getJSON<CollectionDetailApiShape>(`/api/v1/collections/${encodeURIComponent(slug)}`, options);
}

export async function fetchAdvices(options?: { lang?: string }): Promise<Advice[]> {
  const data = await getJSON<{ items: Advice[] }>(`/api/v1/advices`, options);
  return data?.items ?? [];
}

export async function fetchShopMediaSections(options?: { lang?: string }): Promise<ShopMediaSection[]> {
  const data = await getJSON<{ items: ShopMediaSection[] }>(`/api/v1/shop-media-sections`, options);
  return data?.items ?? [];
}

export async function fetchAnnouncements(options?: { lang?: string }): Promise<string[] | null> {
  const data = await getJSON<{ items: string[] }>(`/api/v1/announcements`, options);
  return data?.items ?? null;
}

export async function fetchCustomerOrders(accessToken: string): Promise<OrderSummary[]> {
  const data = await authedGetJSON<{ items: OrderSummary[] }>(`/api/v1/orders`, accessToken);
  return data?.items ?? [];
}

export async function fetchCustomerOrderById(id: number, accessToken: string): Promise<Order | null> {
  return authedGetJSON<Order>(`/api/v1/orders/${id}`, accessToken);
}

export async function fetchPublicReviews(
  entityType: ReviewEntityType,
  entityId: number,
  page: number,
  pageSize: number
): Promise<ReviewPage | null> {
  return getJSON<ReviewPage>(
    `/api/v1/reviews/${entityType}/${entityId}?page=${page}&pageSize=${pageSize}`
  );
}

export async function submitReview(accessToken: string, input: ReviewCreateInput) {
  return authedMutationJSON<{ id: number }>("/api/v1/reviews", accessToken, { method: "POST", body: input });
}

export async function claimReviewPrompt(accessToken: string) {
  return authedMutationJSON<ReviewPrompt>("/api/v1/reviews/prompt/claim", accessToken, { method: "POST" });
}

export async function submitCheckout(
  input: CheckoutRequestDto,
  accessToken: string | null,
  options?: { requireAuthentication?: boolean; idempotencyKey?: string }
): Promise<CheckoutResponseDto | null> {
  let requestToken = accessToken;
  if (options?.requireAuthentication && !requestToken) {
    const revision = getAuthSessionRevision();
    requestToken = await refreshAccessTokenOrNull();
    if (!requestToken || getAuthSessionRevision() !== revision) {
      throw new Error("Authentication required");
    }
  }
  return authedMutationJSON(
    "/api/v1/checkout",
    requestToken,
    { method: "POST", body: input, retryOn401: false, idempotencyKey: options?.idempotencyKey }
  );
}

export type PaymobMethodAvailability = { available: boolean; methods: Array<"card" | "wallet"> };

export type CheckoutStatus = {
  checkoutId: string;
  status: "payment_pending" | "completed" | "expired";
  expiresAt: string;
  attemptsUsed: number;
  latestAttemptStatus: string | null;
  canRetry: boolean;
  order: { id: number; orderCode: string } | null;
};

export async function fetchPaymobMethods(): Promise<PaymobMethodAvailability> {
  const response = await fetch(`${API_BASE}/api/v1/payments/paymob/methods`, { cache: "no-store" });
  if (!response.ok) throw new Error("Payment methods are unavailable");
  return response.json() as Promise<PaymobMethodAvailability>;
}

export async function fetchCheckoutStatus(checkoutId: string): Promise<CheckoutStatus> {
  const response = await fetch(`${API_BASE}/api/v1/checkout/${encodeURIComponent(checkoutId)}/status`,
    { cache: "no-store" });
  if (!response.ok) throw new Error("Checkout status is unavailable");
  return response.json() as Promise<CheckoutStatus>;
}

export async function retryPaymobCheckout(checkoutId: string): Promise<Extract<CheckoutResponseDto,
  { kind: "paymob_redirect" }> | null> {
  return authedMutationJSON(`/api/v1/checkout/${encodeURIComponent(checkoutId)}/retry`, null,
    { method: "POST", retryOn401: false });
}

export {
  getCategoryById,
  getCategoryBySlug,
  getCategoryPath,
  getOffersForProduct
};
