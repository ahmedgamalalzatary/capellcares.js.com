"use client";

import type { AdminOrderDto, AdminOrderReviewFlagDto, AdminShipmentListItemDto, Advice, Announcement, Category, Collection, Offer, OrderSummary, Product, ShopMediaSection } from "@capella/shared";
import type { ShippingBulkRequest, ShippingBulkResult } from "@capella/shared";
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
import { getErrorMessage } from "@/lib/errors";
import { hasErpPermission } from "@/lib/erp-permissions";
import type {
  CategoryApiShape,
  CategoryUpsertInput,
  ErpStoreSnapshot,
  Listener,
  PaymobReconciliationPayload,
  ProductApiShape,
  SalesAnalytics
} from "./types";

/** Focus/visibility refetches are skipped while the last load is younger than this. */
const FOCUS_REFRESH_MIN_AGE_MS = 60_000;

/** Identity + permissions of a user; the preload set only changes when this does. */
function authUserKey(user: AdminAuthUser | null) {
  return user ? JSON.stringify([user.email, user.role, [...(user.permissionKeys ?? [])].sort()]) : "";
}

export class ErpStore {
  products: Product[] = [];
  categories: Category[] = [];
  collections: Collection[] = [];
  offers: Offer[] = [];
  advices: Advice[] = [];
  shopMediaSections: ShopMediaSection[] = [];
  announcements: Announcement[] = [];
  announcementBarStatus: "active" | "inactive" = "active";
  orders: OrderSummary[] = [];
  sales: SalesAnalytics = this.createEmptySales();
  loaded = false;
  loading = false;
  error: string | null = null;
  private listeners = new Set<Listener>();
  private latestRefetchId = 0;
  private lastLoadedAt = 0;
  private loadedUserKey: string | null = null;
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
      announcements: this.announcements,
      announcementBarStatus: this.announcementBarStatus,
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

  private resetData() {
    this.products = [];
    this.categories = [];
    this.collections = [];
    this.offers = [];
    this.advices = [];
    this.shopMediaSections = [];
    this.announcements = [];
    this.announcementBarStatus = "active";
    this.orders = [];
    this.sales = this.createEmptySales();
  }

  /** Runs a write call, then refetches so the store mirrors the server. */
  private async mutate(call: () => Promise<unknown>) {
    await call();
    await this.refetch();
  }

  /** Deletes, drops the row locally so the UI updates immediately, then refetches in the background. */
  private async hardDelete(key: "products" | "categories" | "offers" | "collections", path: string, id: number) {
    await api.del(path);
    const remaining = (this[key] as Array<{ id: number }>).filter((item) => item.id !== id);
    (this as unknown as Record<string, Array<{ id: number }>>)[key] = remaining;
    this.emit();
    void this.refetch();
  }

  async refetch() {
    const reqId = ++this.latestRefetchId;
    this.loading = true;
    this.emit();
    try {
      const authUser = getAdminAuthUser();
      this.loadedUserKey = authUserKey(authUser);
      const requests = this.getPreloadRequests(authUser);
      const results = await Promise.allSettled(requests.map((request) => request.load()));
      // Ignore stale responses: a newer refetch has superseded this one.
      if (reqId !== this.latestRefetchId) {
        return;
      }
      this.resetData();
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
      this.lastLoadedAt = Date.now();
      this.error = firstError instanceof Error
        ? firstError.message
        : firstError != null
          ? "Failed to load"
          : null;
    } catch (e) {
      if (reqId !== this.latestRefetchId) {
        return;
      }
      this.error = getErrorMessage(e, "Failed to load");
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
      if (this.loaded && !this.loading && Date.now() - this.lastLoadedAt >= FOCUS_REFRESH_MIN_AGE_MS) {
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

    // A silent session renewal changes only the token, so reload only when there is nothing good to keep.
    subscribeAdminAccessToken((token) => {
      if (token && isAdminAuthHydrated() && !this.loading && (!this.loaded || this.error)) {
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

    subscribeAdminAuthUser((user) => {
      // Session renewal re-sets the same user; only a different user or permission set changes what may be preloaded.
      if (authUserKey(user) === this.loadedUserKey) {
        return;
      }
      this.loaded = false;
      if (isAdminAuthHydrated() && !this.loading) {
        void this.refetch();
      }
    });
    this.authUserBound = true;
  }

  private getPreloadRequests(authUser: AdminAuthUser | null) {
    const canRead = (permissionKey: string) => hasErpPermission(authUser, permissionKey);

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
      canRead("shop_media.read") && {
        load: () => api.get<{ barStatus?: "active" | "inactive"; items: Announcement[] }>("/api/erp/announcements"),
        assign: (result: { barStatus?: "active" | "inactive"; items: Announcement[] }, store: ErpStore) => {
          store.announcements = result.items;
          store.announcementBarStatus = result.barStatus ?? "active";
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
    await this.mutate(() => api.post("/api/erp/products", p));
  }

  async softDeleteProduct(id: number) {
    await this.mutate(() => api.del(`/api/erp/products/${id}`));
  }

  async restoreProduct(id: number) {
    await this.mutate(() => api.post(`/api/erp/products/${id}/restore`));
  }

  async hardDeleteProduct(id: number) {
    await this.hardDelete("products", `/api/erp/products/${id}/permanent`, id);
  }

  async toggleProductStatus(id: number) {
    await this.mutate(() => api.post(`/api/erp/products/${id}/toggle-status`));
  }

  async setVariantStock(productId: number, variantId: number, stock: number) {
    await this.mutate(() => api.post(`/api/erp/products/${productId}/variants/${variantId}/stock`, { stock }));
  }

  async reorderProducts(input: { categoryId: number | null; ids: number[] }) {
    await this.mutate(() => api.post("/api/erp/products/reorder", input));
  }

  async reorderOffers(input: { ids: number[] }) {
    await this.mutate(() => api.post("/api/erp/offers/reorder", input));
  }

  async reorderCollections(input: { ids: number[] }) {
    await this.mutate(() => api.post("/api/erp/collections/reorder", input));
  }

  async upsertCategory(c: CategoryUpsertInput) {
    await this.mutate(() => api.post("/api/erp/categories", c));
  }

  async reorderCategories(input: { parentId: number | null; ids: number[] }) {
    await this.mutate(() => api.post("/api/erp/categories/reorder", input));
  }

  async softDeleteCategory(id: number): Promise<{ ok: true } | { ok: false; reason: "has-products" }> {
    try {
      await this.mutate(() => api.del(`/api/erp/categories/${id}`));
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
    await this.mutate(() => api.post(`/api/erp/categories/${id}/restore`));
  }

  async hardDeleteCategory(id: number) {
    await this.hardDelete("categories", `/api/erp/categories/${id}/permanent`, id);
  }

  async upsertOffer(o: Omit<Offer, "id"> & { id?: number }) {
    await this.mutate(() => api.post("/api/erp/offers", o));
  }

  async upsertCollection(collection: Omit<Collection, "id"> & { id?: number }) {
    await this.mutate(() => api.post("/api/erp/collections", collection));
  }

  async softDeleteOffer(id: number) {
    await this.mutate(() => api.del(`/api/erp/offers/${id}`));
  }

  async softDeleteCollection(id: number) {
    await this.mutate(() => api.del(`/api/erp/collections/${id}`));
  }

  async restoreOffer(id: number) {
    await this.mutate(() => api.post(`/api/erp/offers/${id}/restore`));
  }

  async hardDeleteOffer(id: number) {
    await this.hardDelete("offers", `/api/erp/offers/${id}/permanent`, id);
  }

  async hardDeleteCollection(id: number) {
    await this.hardDelete("collections", `/api/erp/collections/${id}/permanent`, id);
  }

  async restoreCollection(id: number) {
    await this.mutate(() => api.post(`/api/erp/collections/${id}/restore`));
  }

  async toggleOfferStatus(id: number) {
    await this.mutate(() => api.post(`/api/erp/offers/${id}/toggle-status`));
  }

  async toggleCollectionStatus(id: number) {
    await this.mutate(() => api.post(`/api/erp/collections/${id}/toggle-status`));
  }

  async upsertAdvice(advice: Omit<Advice, "id" | "createdAt" | "updatedAt" | "sortOrder"> & { id?: number }) {
    await this.mutate(() => api.post("/api/erp/advices", advice));
  }

  async reorderAdvices(input: { ids: number[] }) {
    await this.mutate(() => api.post("/api/erp/advices/reorder", input));
  }

  async toggleAdviceStatus(id: number) {
    await this.mutate(() => api.post(`/api/erp/advices/${id}/toggle-status`));
  }

  async deleteAdvice(id: number) {
    await this.mutate(() => api.del(`/api/erp/advices/${id}`));
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
    await this.mutate(() => api.post(`/api/erp/shop-media-sections/${slot}`, input));
  }

  async replaceAnnouncements(input: {
    barStatus: "active" | "inactive";
    items: Array<{
      arText: string;
      enText: string;
      status: "active" | "inactive";
      sortOrder: number;
    }>;
  }) {
    await this.mutate(() => api.post("/api/erp/announcements", input));
  }

  async fetchOrder(id: number): Promise<AdminOrderDto> {
    return api.get(`/api/erp/orders/${id}`);
  }

  async fetchOpenOrderReviewFlags(): Promise<AdminOrderReviewFlagDto[]> {
    const result = await api.get<{ items: AdminOrderReviewFlagDto[] }>("/api/erp/orders/review-flags");
    return result.items;
  }

  /** Acknowledging an alert is pure staff visibility; it never denies, refunds or restocks the order. */
  async resolveOrderReviewFlag(flagId: number) {
    await api.post(`/api/erp/orders/review-flags/${flagId}/resolve`);
  }

  async fetchPaymobReconciliation(): Promise<PaymobReconciliationPayload> {
    return api.get<PaymobReconciliationPayload>("/api/erp/orders/reconciliation");
  }

  /** Offer a parked callback receipt to the idempotent processor again. Never a blind resend. */
  async requeuePaymobCallback(callbackId: number) {
    await api.post(`/api/erp/orders/reconciliation/callbacks/${callbackId}/requeue`);
  }

  async fetchShippingOverview(cursor?: string): Promise<{ items: AdminShipmentListItemDto[]; nextCursor: string | null }> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return api.get<{ items: AdminShipmentListItemDto[]; nextCursor: string | null }>(`/api/erp/shipping${query}`);
  }

  async updateOrderPaymentStatus(id: number, paymentStatus: "pending" | "accepted" | "denied") {
    await api.post(`/api/erp/orders/${id}/payment-status`, { paymentStatus });
    await this.refetch();
  }

  async performShippingAction(orderId: number, input: Omit<ShippingBulkRequest, "orderIds"> & { flagId?: number }) {
    const base = `/api/erp/shipping/orders/${orderId}`;
    switch (input.action) {
      case "retry": return api.post(`${base}/retry`);
      case "reconcile": return api.post(`${base}/reconcile`);
      case "cancel": return api.post(`${base}/cancel`, input.reason ? { reason: input.reason } : {});
      case "manual_state": return api.post(`${base}/manual-state`, { state: input.state, ...(input.reason ? { reason: input.reason } : {}) });
      case "shipment_edit": return api.post(`${base}/shipment-edit`, input.patch);
      case "resolve_flags": return api.post(`${base}/flags/${input.flagId}/resolve`, { note: input.note });
    }
  }

  async runBulkShippingAction(input: ShippingBulkRequest): Promise<{ results: ShippingBulkResult[] }> {
    return api.post("/api/erp/shipping/bulk", input);
  }
}
