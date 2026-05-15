"use client";

// API-backed ERP store: initial state hydrated from /api/erp, mutations go
// through the API and trigger a refetch so storefront sees the same data.

import { useSyncExternalStore } from "react";
import type { Product, Category, Offer } from "@capella/shared";
import { api } from "./api/client";

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
        api.get<{ items: ProductApiShape[] }>("/api/erp/products"),
        api.get<{ items: CategoryApiShape[] }>("/api/erp/categories"),
        api.get<{ items: Offer[] }>("/api/erp/offers")
      ]);
      this.products = p.items.map(normalizeProduct);
      this.categories = c.items.map(normalizeCategory);
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
