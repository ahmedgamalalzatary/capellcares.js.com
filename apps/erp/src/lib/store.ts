"use client";

// API-backed ERP store: initial state hydrated from /api/erp, mutations go
// through the API and trigger a refetch so storefront sees the same data.

import { useSyncExternalStore } from "react";
import type { Advice, Category, Offer, Order, OrderSummary, Product } from "@capella/shared";
import { api, isAdminAuthHydrated, subscribeAdminAccessToken, subscribeAdminAuthHydration } from "./api/client";

type Listener = () => void;
type CategoryUpsertInput = Omit<Category, "id"> & { id?: number };
type ProductApiShape = {
  id: number;
  sku?: string;
  slug?: string;
  name?: { ar?: string; en?: string };
  arName?: string;
  enName?: string;
  description?: { ar?: string; en?: string };
  arDescription?: string | null;
  enDescription?: string | null;
  ingredients?: { ar?: string; en?: string };
  arIngredients?: string | null;
  enIngredients?: string | null;
  howToUse?: { ar?: string; en?: string };
  arHowToUse?: string | null;
  enHowToUse?: string | null;
  warnings?: { ar?: string; en?: string };
  arWarnings?: string | null;
  enWarnings?: string | null;
  keywords?: string[] | string;
  buyingPrice?: number | string;
  imagePath?: string | null;
  youtubeUrl?: string | null;
  status?: "active" | "inactive";
  categoryId?: number | string;
  variants?: Array<{
    id?: number | string;
    productId?: number | string;
    size?: string;
    sizeLabel?: string;
    price?: number | string;
    sellingPrice?: number | string;
    stock?: number | string;
    stockQty?: number | string;
    sortOrder?: number | string;
  }>;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  isNew?: boolean;
  isBestseller?: boolean;
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

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBilingual(
  value: { ar?: string; en?: string } | undefined,
  arFallback?: string,
  enFallback?: string
) {
  return {
    ar: value?.ar ?? arFallback ?? "",
    en: value?.en ?? enFallback ?? ""
  };
}

function normalizeProduct(input: ProductApiShape): Product {
  return {
    id: toNumber(input.id),
    sku: input.sku ?? "",
    slug: input.slug ?? "",
    name: toBilingual(input.name, input.arName, input.enName),
    description: toBilingual(input.description, input.arDescription ?? undefined, input.enDescription ?? undefined),
    ingredients: toBilingual(input.ingredients, input.arIngredients ?? undefined, input.enIngredients ?? undefined),
    howToUse: toBilingual(input.howToUse, input.arHowToUse ?? undefined, input.enHowToUse ?? undefined),
    warnings: toBilingual(input.warnings, input.arWarnings ?? undefined, input.enWarnings ?? undefined),
    keywords: Array.isArray(input.keywords)
      ? input.keywords
      : typeof input.keywords === "string"
        ? input.keywords.split(",").map((x) => x.trim()).filter(Boolean)
        : [],
    buyingPrice: toNumber(input.buyingPrice),
    imagePath: input.imagePath ?? "",
    youtubeUrl: input.youtubeUrl ?? undefined,
    status: input.status ?? "inactive",
    isNew: input.isNew ?? false,
    isBestseller: input.isBestseller ?? false,
    categoryId: toNumber(input.categoryId),
    variants: (input.variants ?? []).map((v, index) => ({
      id: toNumber(v.id),
      productId: toNumber(v.productId, toNumber(input.id)),
      size: v.size ?? v.sizeLabel ?? "",
      price: toNumber(v.price ?? v.sellingPrice),
      stock: toNumber(v.stock ?? v.stockQty),
      sortOrder: toNumber(v.sortOrder, index + 1)
    })),
    offerIds: [],
    createdAt: input.createdAt ?? "",
    updatedAt: input.updatedAt ?? "",
    deletedAt: input.deletedAt ?? null
  };
}

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

class ErpStore {
  products: Product[] = [];
  categories: Category[] = [];
  offers: Offer[] = [];
  advices: Advice[] = [];
  orders: OrderSummary[] = [];
  loaded = false;
  loading = false;
  error: string | null = null;
  private listeners = new Set<Listener>();
  private browserRefreshBound = false;
  private authRefreshBound = false;
  private authHydrationBound = false;

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  async refetch() {
    this.loading = true;
    this.emit();
    try {
      const [p, c, o, a, orderData] = await Promise.all([
        api.get<{ items: ProductApiShape[] }>("/api/erp/products"),
        api.get<{ items: CategoryApiShape[] }>("/api/erp/categories"),
        api.get<{ items: Offer[] }>("/api/erp/offers"),
        api.get<{ items: Advice[] }>("/api/erp/advices"),
        api.get<{ items: OrderSummary[] }>("/api/erp/orders")
      ]);
      this.products = p.items.map(normalizeProduct);
      this.categories = c.items.map(normalizeCategory);
      this.offers = o.items;
      this.advices = a.items;
      this.orders = orderData.items;
      this.loaded = true;
      this.error = null;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to load";
    } finally {
      this.loading = false;
      this.emit();
    }
  }

  ensureLoaded() {
    this.bindBrowserRefresh();
    this.bindAuthRefresh();
    this.bindAuthHydration();
    if (!this.loaded && !this.loading && isAdminAuthHydrated()) void this.refetch();
  }

  private bindBrowserRefresh() {
    if (this.browserRefreshBound || typeof window === "undefined") {
      return;
    }

    const refreshIfLoaded = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      if (this.loaded && !this.loading) {
        void this.refetch();
      }
    };

    window.addEventListener("focus", refreshIfLoaded);
    document.addEventListener("visibilitychange", refreshIfLoaded);
    this.browserRefreshBound = true;
  }

  private bindAuthRefresh() {
    if (this.authRefreshBound || typeof window === "undefined") {
      return;
    }

    subscribeAdminAccessToken((token) => {
      if (token && isAdminAuthHydrated() && !this.loading) {
        void this.refetch();
      }
    });
    this.authRefreshBound = true;
  }

  private bindAuthHydration() {
    if (this.authHydrationBound || typeof window === "undefined") {
      return;
    }

    subscribeAdminAuthHydration((hydrated) => {
      if (hydrated && !this.loaded && !this.loading) {
        void this.refetch();
      }
    });
    this.authHydrationBound = true;
  }

  // products
  async upsertProduct(p: Product) {
    await api.post("/api/erp/products", p);
    await this.refetch();
  }
  async softDeleteProduct(id: number) {
    await api.del(`/api/erp/products/${id}`);
    await this.refetch();
  }
  async restoreProduct(id: number) {
    await api.post(`/api/erp/products/${id}/restore`);
    await this.refetch();
  }
  async hardDeleteProduct(id: number) {
    await api.del(`/api/erp/products/${id}/permanent`);
    this.products = this.products.filter((p) => p.id !== id);
    this.emit();
    void this.refetch();
  }
  async toggleProductStatus(id: number) {
    await api.post(`/api/erp/products/${id}/toggle-status`);
    await this.refetch();
  }
  async setVariantStock(productId: number, variantId: number, stock: number) {
    await api.post(`/api/erp/products/${productId}/variants/${variantId}/stock`, { stock });
    await this.refetch();
  }

  // categories
  async upsertCategory(c: CategoryUpsertInput) {
    await api.post("/api/erp/categories", c);
    await this.refetch();
  }
  async softDeleteCategory(id: number): Promise<{ ok: true } | { ok: false; reason: "has-products" }> {
    try {
      await api.del(`/api/erp/categories/${id}`);
      await this.refetch();
      return { ok: true };
    } catch (e: unknown) {
      const err = e as { status?: number; body?: { reason?: string } };
      if (err?.status === 409 && err.body?.reason === "has-products") {
        return { ok: false, reason: "has-products" };
      }
      throw e;
    }
  }
  async restoreCategory(id: number) {
    await api.post(`/api/erp/categories/${id}/restore`);
    await this.refetch();
  }

  // offers
  async upsertOffer(o: Omit<Offer, "id"> & { id?: number }) {
    await api.post("/api/erp/offers", o);
    await this.refetch();
  }
  async softDeleteOffer(id: number) {
    await api.del(`/api/erp/offers/${id}`);
    await this.refetch();
  }
  async restoreOffer(id: number) {
    await api.post(`/api/erp/offers/${id}/restore`);
    await this.refetch();
  }
  async toggleOfferStatus(id: number) {
    await api.post(`/api/erp/offers/${id}/toggle-status`);
    await this.refetch();
  }

  async upsertAdvice(advice: Omit<Advice, "id" | "createdAt" | "updatedAt"> & { id?: number }) {
    await api.post("/api/erp/advices", advice);
    await this.refetch();
  }
  async toggleAdviceStatus(id: number) {
    await api.post(`/api/erp/advices/${id}/toggle-status`);
    await this.refetch();
  }
  async deleteAdvice(id: number) {
    await api.del(`/api/erp/advices/${id}`);
    await this.refetch();
  }

  async fetchOrder(id: number): Promise<Order> {
    return api.get(`/api/erp/orders/${id}`);
  }
  async updateOrderPaymentStatus(id: number, paymentStatus: "pending" | "accepted" | "denied") {
    await api.post(`/api/erp/orders/${id}/payment-status`, { paymentStatus });
    await this.refetch();
  }
}

let _instance: ErpStore | null = null;
export function getStore(): ErpStore {
  if (!_instance) _instance = new ErpStore();
  return _instance;
}

export function useStore<T>(selector: (s: ErpStore) => T): T {
  const store = getStore();
  if (typeof window !== "undefined") store.ensureLoaded();
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => selector(store),
    () => selector(store)
  );
}
