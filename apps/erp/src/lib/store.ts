"use client";

// In-memory mock ERP store used to let admin actions (create/update/delete)
// take effect inside the running session. Seeded from @capella/shared mock.

import { mock, type Product, type Category, type Offer } from "@capella/shared";

type Listener = () => void;

class ErpStore {
  products: Product[] = mock.products.map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v })) }));
  categories: Category[] = mock.categories.map((c) => ({ ...c }));
  offers: Offer[] = mock.offers.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i })) }));
  private listeners = new Set<Listener>();

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  // products
  upsertProduct(p: Product) {
    const i = this.products.findIndex((x) => x.id === p.id);
    if (i === -1) this.products = [...this.products, p];
    else { this.products = [...this.products]; this.products[i] = p; }
    this.emit();
  }
  softDeleteProduct(id: number) {
    const i = this.products.findIndex((x) => x.id === id);
    if (i === -1) return;
    this.products = [...this.products];
    this.products[i] = { ...this.products[i], deletedAt: new Date().toISOString() };
    this.emit();
  }
  restoreProduct(id: number) {
    const i = this.products.findIndex((x) => x.id === id);
    if (i === -1) return;
    this.products = [...this.products];
    this.products[i] = { ...this.products[i], deletedAt: null };
    this.emit();
  }
  toggleProductStatus(id: number) {
    const i = this.products.findIndex((x) => x.id === id);
    if (i === -1) return;
    this.products = [...this.products];
    const cur = this.products[i];
    this.products[i] = { ...cur, status: cur.status === "active" ? "inactive" : "active" };
    this.emit();
  }
  setVariantStock(productId: number, variantId: number, stock: number) {
    const i = this.products.findIndex((x) => x.id === productId);
    if (i === -1) return;
    const variants = this.products[i].variants.map((v) => v.id === variantId ? { ...v, stock: Math.max(0, stock) } : v);
    this.products = [...this.products];
    this.products[i] = { ...this.products[i], variants };
    this.emit();
  }

  // categories
  upsertCategory(c: Category) {
    const i = this.categories.findIndex((x) => x.id === c.id);
    if (i === -1) this.categories = [...this.categories, c];
    else { this.categories = [...this.categories]; this.categories[i] = c; }
    this.emit();
  }
  softDeleteCategory(id: number): { ok: true } | { ok: false; reason: "has-products" } {
    const linked = this.products.some((p) => !p.deletedAt && p.categoryId === id);
    if (linked) return { ok: false, reason: "has-products" };
    const i = this.categories.findIndex((x) => x.id === id);
    if (i === -1) return { ok: true };
    this.categories = [...this.categories];
    this.categories[i] = { ...this.categories[i], deletedAt: new Date().toISOString() };
    this.emit();
    return { ok: true };
  }
  restoreCategory(id: number) {
    const i = this.categories.findIndex((x) => x.id === id);
    if (i === -1) return;
    this.categories = [...this.categories];
    this.categories[i] = { ...this.categories[i], deletedAt: null };
    this.emit();
  }

  // offers
  upsertOffer(o: Offer) {
    const i = this.offers.findIndex((x) => x.id === o.id);
    if (i === -1) this.offers = [...this.offers, o];
    else { this.offers = [...this.offers]; this.offers[i] = o; }
    this.emit();
  }
  softDeleteOffer(id: number) {
    const i = this.offers.findIndex((x) => x.id === id);
    if (i === -1) return;
    this.offers = [...this.offers];
    this.offers[i] = { ...this.offers[i], deletedAt: new Date().toISOString() };
    this.emit();
  }
  restoreOffer(id: number) {
    const i = this.offers.findIndex((x) => x.id === id);
    if (i === -1) return;
    this.offers = [...this.offers];
    this.offers[i] = { ...this.offers[i], deletedAt: null };
    this.emit();
  }
}

let _instance: ErpStore | null = null;
export function getStore(): ErpStore {
  if (!_instance) _instance = new ErpStore();
  return _instance;
}

import { useSyncExternalStore } from "react";

export function useStore<T>(selector: (s: ErpStore) => T): T {
  const store = getStore();
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => selector(store),
    () => selector(store)
  );
}
