import type {
  Advice,
  Category,
  Collection,
  Offer,
  Order,
  OrderSummary,
  Product,
  StorefrontCollectionDetail,
  StorefrontOfferDetail,
  StorefrontProductDetail
} from "@capella/shared";
import { authedGetJSON, getJSON } from "./client/http";
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
  getOffersForProduct
};
