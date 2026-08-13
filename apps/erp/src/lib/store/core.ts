"use client";

import type { Advice, Category, Collection, Offer, Order, OrderSummary, Product, ShopMediaSection } from "@capella/shared";
import {
  api,
  getAdminAuthUser,
  isAdminAuthHydrated,
  subscribeAdminAccessToken,
  subscribeAdminAuthHydration,
  subscribeAdminAuthUser,
  type AdminAuthUser
} from "../api/client";
import { normalizeCategory, normalizeProduct } from "./normalizers";
import type {
  CategoryApiShape,
  CategoryUpsertInput,
  ErpStoreSnapshot,
  Listener,
  ProductApiShape,
  SalesAnalytics
} from "./types";

export class ErpStore {
  products: Product[] = [];
  categories: Category[] = [];
  collections: Collection[] = [];
  offers: Offer[] = [];
  advices: Advice[] = [];
  shopMediaSections: ShopMediaSection[] = [];
  orders: OrderSummary[] = [];
  sales: SalesAnalytics = {
    summary: { totalOrders: 0, totalUnitsSold: 0, totalRevenue: 0 },
    productTotals: [],
    variantTotals: [],
    orders: []
  };
  loaded = false;
  loading = false;
  error: string | null = null;
  private listeners = new Set<Listener>();
  private latestRefetchId = 0;
  private browserRefreshBound = false;
  private authRefreshBound = false;
  private authHydrationBound = false;
  private authUserBound = false;

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  getSnapshot(): ErpStoreSnapshot {
    return {
      products: this.products,
      categories: this.categories,
      collections: this.collections,
      offers: this.offers,
      advices: this.advices,
      shopMediaSections: this.shopMediaSections,
      orders: this.orders,
      sales: this.sales,
      loaded: this.loaded,
      loading: this.loading,
      error: this.error
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private createEmptySales(): SalesAnalytics {
    return {
      summary: { totalOrders: 0, totalUnitsSold: 0, totalRevenue: 0 },
      productTotals: [],
      variantTotals: [],
      orders: []
    };
  }

  async refetch() {
    const reqId = ++this.latestRefetchId;
    this.loading = true;
    this.emit();
    try {
      const authUser = getAdminAuthUser();
      const requests = this.getPreloadRequests(authUser);
      const results = await Promise.allSettled(requests.map((request) => request.load()));
      // Ignore stale responses: a newer refetch has superseded this one.
      if (reqId !== this.latestRefetchId) {
        return;
      }
      this.products = [];
      this.categories = [];
      this.collections = [];
      this.offers = [];
      this.advices = [];
      this.shopMediaSections = [];
      this.orders = [];
      this.sales = this.createEmptySales();
      let firstError: unknown = null;
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          requests[index]?.assign(result.value, this);
          return;
        }

        if (firstError == null) {
          firstError = result.reason;
        }
      });
      this.loaded = true;
      this.error = firstError instanceof Error
        ? firstError.message
        : firstError != null
          ? "Failed to load"
          : null;
    } catch (e) {
      if (reqId !== this.latestRefetchId) {
        return;
      }
      this.error = e instanceof Error ? e.message : "Failed to load";
    } finally {
      if (reqId === this.latestRefetchId) {
        this.loading = false;
        this.emit();
      }
    }
  }

  ensureLoaded() {
    this.bindBrowserRefresh();
    this.bindAuthRefresh();
    this.bindAuthHydration();
    this.bindAuthUser();
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

  private bindAuthUser() {
    if (this.authUserBound || typeof window === "undefined") {
      return;
    }

    subscribeAdminAuthUser(() => {
      this.loaded = false;
      if (isAdminAuthHydrated() && !this.loading) {
        void this.refetch();
      }
    });
    this.authUserBound = true;
  }

  private getPreloadRequests(authUser: AdminAuthUser | null) {
    const canRead = authUser?.role === "admin"
      ? () => true
      : (permissionKey: string) => authUser?.permissionKeys.includes(permissionKey) ?? false;

    return [
      canRead("products.read") && {
        load: () => api.get<{ items: ProductApiShape[] }>("/api/erp/products"),
        assign: (result: { items: ProductApiShape[] }, store: ErpStore) => {
          store.products = result.items.map(normalizeProduct);
        }
      },
      canRead("categories.read") && {
        load: () => api.get<{ items: CategoryApiShape[] }>("/api/erp/categories"),
        assign: (result: { items: CategoryApiShape[] }, store: ErpStore) => {
          store.categories = result.items.map(normalizeCategory);
        }
      },
      canRead("collections.read") && {
        load: () => api.get<{ items: Collection[] }>("/api/erp/collections"),
        assign: (result: { items: Collection[] }, store: ErpStore) => {
          store.collections = result.items;
        }
      },
      canRead("offers.read") && {
        load: () => api.get<{ items: Offer[] }>("/api/erp/offers"),
        assign: (result: { items: Offer[] }, store: ErpStore) => {
          store.offers = result.items;
        }
      },
      canRead("advices.read") && {
        load: () => api.get<{ items: Advice[] }>("/api/erp/advices"),
        assign: (result: { items: Advice[] }, store: ErpStore) => {
          store.advices = result.items;
        }
      },
      canRead("shop_media.read") && {
        load: () => api.get<{ items: ShopMediaSection[] }>("/api/erp/shop-media-sections"),
        assign: (result: { items: ShopMediaSection[] }, store: ErpStore) => {
          store.shopMediaSections = result.items;
        }
      },
      canRead("orders.read") && {
        load: () => api.get<{ items: OrderSummary[] }>("/api/erp/orders"),
        assign: (result: { items: OrderSummary[] }, store: ErpStore) => {
          store.orders = result.items;
        }
      },
      canRead("sales.read") && {
        load: () => api.get<SalesAnalytics>("/api/erp/sales"),
        assign: (result: Partial<SalesAnalytics>, store: ErpStore) => {
          const emptySales = store.createEmptySales();
          store.sales = {
            summary: result.summary ?? emptySales.summary,
            productTotals: result.productTotals ?? emptySales.productTotals,
            variantTotals: result.variantTotals ?? emptySales.variantTotals,
            orders: result.orders ?? emptySales.orders
          };
        }
      }
    ].filter(Boolean) as Array<{
      load: () => Promise<unknown>;
      assign: (result: any, store: ErpStore) => void;
    }>;
  }

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

  async reorderProducts(input: { categoryId: number | null; ids: number[] }) {
    await api.post("/api/erp/products/reorder", input);
    await this.refetch();
  }

  async reorderOffers(input: { ids: number[] }) {
    await api.post("/api/erp/offers/reorder", input);
    await this.refetch();
  }

  async reorderCollections(input: { ids: number[] }) {
    await api.post("/api/erp/collections/reorder", input);
    await this.refetch();
  }

  async upsertCategory(c: CategoryUpsertInput) {
    await api.post("/api/erp/categories", c);
    await this.refetch();
  }

  async reorderCategories(input: { parentId: number | null; ids: number[] }) {
    await api.post("/api/erp/categories/reorder", input);
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

  async hardDeleteCategory(id: number) {
    await api.del(`/api/erp/categories/${id}/permanent`);
    this.categories = this.categories.filter((category) => category.id !== id);
    this.emit();
    void this.refetch();
  }

  async upsertOffer(o: Omit<Offer, "id"> & { id?: number }) {
    await api.post("/api/erp/offers", o);
    await this.refetch();
  }

  async upsertCollection(collection: Omit<Collection, "id"> & { id?: number }) {
    await api.post("/api/erp/collections", collection);
    await this.refetch();
  }

  async softDeleteOffer(id: number) {
    await api.del(`/api/erp/offers/${id}`);
    await this.refetch();
  }

  async softDeleteCollection(id: number) {
    await api.del(`/api/erp/collections/${id}`);
    await this.refetch();
  }

  async restoreOffer(id: number) {
    await api.post(`/api/erp/offers/${id}/restore`);
    await this.refetch();
  }

  async hardDeleteOffer(id: number) {
    await api.del(`/api/erp/offers/${id}/permanent`);
    this.offers = this.offers.filter((offer) => offer.id !== id);
    this.emit();
    void this.refetch();
  }

  async hardDeleteCollection(id: number) {
    await api.del(`/api/erp/collections/${id}/permanent`);
    this.collections = this.collections.filter((collection) => collection.id !== id);
    this.emit();
    void this.refetch();
  }

  async restoreCollection(id: number) {
    await api.post(`/api/erp/collections/${id}/restore`);
    await this.refetch();
  }

  async toggleOfferStatus(id: number) {
    await api.post(`/api/erp/offers/${id}/toggle-status`);
    await this.refetch();
  }

  async toggleCollectionStatus(id: number) {
    await api.post(`/api/erp/collections/${id}/toggle-status`);
    await this.refetch();
  }

  async upsertAdvice(advice: Omit<Advice, "id" | "createdAt" | "updatedAt" | "sortOrder"> & { id?: number }) {
    await api.post("/api/erp/advices", advice);
    await this.refetch();
  }

  async reorderAdvices(input: { ids: number[] }) {
    await api.post("/api/erp/advices/reorder", input);
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

  async updateShopMediaSection(
    slot: 1 | 2 | 3 | 4 | 5,
    input: { status: "active" | "inactive"; items: Array<{
      arImagePath: string | null;
      arMobileImagePath: string | null;
      enImagePath: string | null;
      enMobileImagePath: string | null;
      targetType: string;
      targetId: number | null;
      sortOrder: number;
    }> }
  ) {
    await api.post(`/api/erp/shop-media-sections/${slot}`, input);
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
