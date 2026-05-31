import type {
  Advice,
  Category,
  Offer,
  Order,
  OrderSummary,
  Product,
  StorefrontOfferDetail,
  StorefrontProductDetail
} from "@capella/shared";
import { authedGetJSON, getJSON } from "./client/http";
import { normalizeCategory, normalizeProduct } from "./client/normalizers";
import {
  getCategoryById,
  getCategoryBySlug,
  getCategoryPath,
  getDescendantCategoryIds,
  getOffersForProduct,
  getProductsByCategory
} from "./client/selectors";
import type {
  CategoryApiShape,
  OfferDetailApiShape,
  ProductApiShape,
  ProductDetailApiShape
} from "./client/types";

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

export async function fetchCustomerOrders(accessToken: string): Promise<OrderSummary[]> {
  const data = await authedGetJSON<{ items: OrderSummary[] }>(`/api/v1/orders`, accessToken);
  return data?.items ?? [];
}

export async function fetchCustomerOrderById(id: number, accessToken: string): Promise<Order | null> {
  return authedGetJSON<Order>(`/api/v1/orders/${id}`, accessToken);
}

export {
  getCategoryById,
  getCategoryBySlug,
  getCategoryPath,
  getDescendantCategoryIds,
  getProductsByCategory,
  getOffersForProduct
};
