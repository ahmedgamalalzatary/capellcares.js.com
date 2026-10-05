import type {
  Advice,
  AppConfig,
  CartLine,
  Category,
  CheckoutRequestDto,
  CheckoutResponseDto,
  CheckoutShippingAvailability,
  CheckoutShippingQuote,
  Collection,
  Offer,
  NativePlatform,
  Order,
  OrderSummary,
  Product,
  ReviewCreateInput,
  ReviewEntityType,
  ReviewPage,
  ReviewPrompt,
  ShopMediaSection,
  ShippingAddress,
  StorefrontCollectionDetail,
  StorefrontOfferDetail,
  StorefrontProductDetail,
  WishlistEntry,
  WishlistEntityType
} from "@capella/shared";
import {
  adviceResponseSchema, appConfigSchema, checkoutResponseSchema,
  announcementResponseSchema, cartResponseSchema, checkoutShippingAvailabilitySchema,
  checkoutShippingQuoteSchema, checkoutStatusSchema, customerOrderSchema,
  customerOrdersSchema, mutationOkSchema, paymobMethodsSchema, paymobRedirectSchema,
  reviewCreatedResponseSchema, reviewPageResponseSchema, reviewPromptResponseSchema, wishlistEntryResponseSchema
} from "@capella/shared";
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

function validated<T>(schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false } }, data: unknown, label: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(200, `Invalid ${label} payload`, "INVALID_PAYLOAD");
  return parsed.data;
}

export async function fetchAppConfig(platform: NativePlatform, options?: LanguageOptions): Promise<AppConfig> {
  const config = validated(appConfigSchema, await getJSON(`/app-config?platform=${encodeURIComponent(platform)}`,
    { ...options, throwOnError: true }), "app config");
  if (config.platform !== platform) throw new ApiError(200, "Invalid app config platform", "INVALID_PAYLOAD");
  return config;
}

export async function fetchCustomerCart(accessToken: string, options?: LanguageOptions): Promise<CartLine[]> {
  return validated(cartResponseSchema, await authedGetJSON("/api/v1/cart", accessToken, options), "cart").lines;
}

export async function replaceCustomerCart(accessToken: string, lines: CartLine[], options?: LanguageOptions): Promise<CartLine[]> {
  return validated(cartResponseSchema, await authedMutationJSON("/api/v1/cart", accessToken,
    { method: "PUT", body: { lines } }, options), "cart").lines;
}

export async function fetchAnnouncements(options?: PublicOptions): Promise<string[] | null> {
  const data = await getJSON("/api/v1/announcements", options);
  if (data == null && !options?.throwOnError) return null;
  return validated(announcementResponseSchema, data, "announcements").items;
}

export async function fetchCheckoutShipping(options?: LanguageOptions): Promise<CheckoutShippingAvailability> {
  return validated(checkoutShippingAvailabilitySchema,
    await getJSON("/api/v1/checkout/shipping", { ...options, throwOnError: true }), "shipping");
}

export async function fetchCheckoutShippingQuote(input: {
  items: CheckoutRequestDto["items"]; paymentMethod: "cod" | "paymob"; shippingAddress: ShippingAddress
}, accessToken: string | null, options?: LanguageOptions): Promise<CheckoutShippingQuote> {
  return validated(checkoutShippingQuoteSchema, await authedMutationJSON("/api/v1/checkout/shipping/quote",
    accessToken, { method: "POST", body: input }, options), "shipping quote");
}

export async function fetchPaymobMethods(options?: LanguageOptions) {
  return validated(paymobMethodsSchema,
    await getJSON("/api/v1/payments/paymob/methods", { ...options, throwOnError: true }), "payment methods");
}

export async function fetchCheckoutStatus(checkoutId: string, options?: LanguageOptions) {
  return validated(checkoutStatusSchema, await getJSON(`/api/v1/checkout/${encodeURIComponent(checkoutId)}/status`,
    { ...options, throwOnError: true }), "checkout status");
}

export async function retryPaymobCheckout(checkoutId: string, options?: LanguageOptions) {
  return validated(paymobRedirectSchema, await authedMutationJSON(`/api/v1/checkout/${encodeURIComponent(checkoutId)}/retry`,
    null, { method: "POST" }, options), "payment retry");
}

export async function cancelCustomerOrder(id: number, accessToken: string, options?: LanguageOptions): Promise<Order> {
  return validated(customerOrderSchema, await authedMutationJSON(`/api/v1/orders/${id}/cancel`, accessToken,
    { method: "POST", body: {} }, options), "order cancellation") as Order;
}

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
  const data = await getJSON("/api/v1/advices", options);
  if (data == null && !options?.throwOnError) return [];
  return validated(adviceResponseSchema, data, "advice").items;
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
  const data = await authedGetJSON(
    "/api/v1/orders",
    accessToken,
    options
  );
  return validated(customerOrdersSchema, data, "orders").items as OrderSummary[];
}

export async function fetchCustomerOrderById(
  id: number,
  accessToken: string,
  options?: LanguageOptions
): Promise<Order | null> {
  const data = await authedGetJSON(`/api/v1/orders/${id}`, accessToken, options);
  return data === null ? null : validated(customerOrderSchema, data, "order") as Order;
}

export async function fetchPublicReviews(
  entityType: ReviewEntityType,
  entityId: number,
  page: number,
  pageSize: number,
  options?: PublicOptions
): Promise<ReviewPage | null> {
  const data = await getJSON(
    `/api/v1/reviews/${entityType}/${entityId}?page=${page}&pageSize=${pageSize}`,
    options
  );
  return data === null ? null : validated(reviewPageResponseSchema, data, "reviews");
}

export async function submitReview(
  accessToken: string,
  input: ReviewCreateInput,
  options?: LanguageOptions
): Promise<{ id: number } | null> {
  const data = await authedMutationJSON(
    "/api/v1/reviews",
    accessToken,
    { method: "POST", body: input },
    options
  );
  return validated(reviewCreatedResponseSchema, data, "review submission");
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
  return prompt ? normalizeReviewPrompt(validated(reviewPromptResponseSchema, prompt, "review prompt")) : null;
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
  return normalizeRows(requireItems<WishlistEntry>(data, "wishlist", true),
    entry => normalizeWishlistEntry(validated(wishlistEntryResponseSchema, entry, "wishlist entry")), "wishlist entry", true);
}

export async function addWishlistItem(
  accessToken: string,
  entityType: WishlistEntityType,
  entityId: number,
  options?: LanguageOptions
): Promise<{ ok: boolean } | null> {
  const data = await authedMutationJSON(
    "/api/v1/wishlist",
    accessToken,
    { method: "POST", body: { entityType, entityId } },
    options
  );
  return validated(mutationOkSchema, data, "wishlist mutation");
}

export async function removeWishlistItem(
  accessToken: string,
  entityType: WishlistEntityType,
  entityId: number,
  options?: LanguageOptions
): Promise<{ ok: boolean } | null> {
  const data = await authedMutationJSON(
    `/api/v1/wishlist/${entityType}/${entityId}`,
    accessToken,
    { method: "DELETE" },
    options
  );
  return validated(mutationOkSchema, data, "wishlist mutation");
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
