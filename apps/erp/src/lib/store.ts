"use client";

// API-backed ERP store: initial state hydrated from /api/erp, mutations go
// through the API and trigger a refetch so storefront sees the same data.

import { useSyncExternalStore } from "react";
import type { Product, Category, Offer } from "@capella/shared";
import { api } from "./api/client";

type Listener = () => void;

class ErpStore {
  products: Product[] = [];
  categories: Category[] = [];
  offers: Offer[] = [];
  loaded = false;
  loading = false;
  error: string | null = null;
  private listeners = new Set<Listener>();

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
      const [p, c, o] = await Promise.all([
        api.get<{ items: Product[] }>("/api/erp/products"),
        api.get<{ items: Category[] }>("/api/erp/categories"),
        api.get<{ items: Offer[] }>("/api/erp/offers")
      ]);
      this.products = p.items;
      this.categories = c.items;
      this.offers = o.items;
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
    if (!this.loaded && !this.loading) void this.refetch();
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
  async toggleProductStatus(id: number) {
    await api.post(`/api/erp/products/${id}/toggle-status`);
    await this.refetch();
  }
  async setVariantStock(productId: number, variantId: number, stock: number) {
    await api.post(`/api/erp/products/${productId}/variants/${variantId}/stock`, { stock });
    await this.refetch();
  }

  // categories
  async upsertCategory(c: Category) {
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
  async upsertOffer(o: Offer) {
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
