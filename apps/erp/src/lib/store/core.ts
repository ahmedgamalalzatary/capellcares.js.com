"use client";

import type { Advice, Category, Collection, Offer, Order, OrderSummary, Product } from "@capella/shared";
import { api, isAdminAuthHydrated, subscribeAdminAccessToken, subscribeAdminAuthHydration } from "../api/client";
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

  async refetch() {
    const reqId = ++this.latestRefetchId;
    this.loading = true;
    this.emit();
    try {
      const [p, c, collectionData, o, a, orderData, salesData] = await Promise.all([
        api.get<{ items: ProductApiShape[] }>("/api/erp/products"),
        api.get<{ items: CategoryApiShape[] }>("/api/erp/categories"),
        api.get<{ items: Collection[] }>("/api/erp/collections"),
        api.get<{ items: Offer[] }>("/api/erp/offers"),
        api.get<{ items: Advice[] }>("/api/erp/advices"),
        api.get<{ items: OrderSummary[] }>("/api/erp/orders"),
        api.get<SalesAnalytics>("/api/erp/sales")
      ]);
      // Ignore stale responses: a newer refetch has superseded this one.
      if (reqId !== this.latestRefetchId) {
        return;
      }
      this.products = p.items.map(normalizeProduct);
      this.categories = c.items.map(normalizeCategory);
      this.collections = collectionData.items;
      this.offers = o.items;
      this.advices = a.items;
      this.orders = orderData.items;
      this.sales = salesData;
      this.loaded = true;
      this.error = null;
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
