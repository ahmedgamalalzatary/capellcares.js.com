import type { Request, Response } from "express";
import { getState, save, nextId } from "../../data/file-store.js";
import type { Product, Category, Offer } from "@capella/shared";

// ---- products ----

export async function adminListProducts(_req: Request, res: Response) {
  const s = await getState();
  res.json({ items: s.products });
}

export async function adminUpsertProduct(req: Request, res: Response) {
  const s = await getState();
  const incoming = req.body as Product;
  const now = new Date().toISOString();
  if (incoming.id && s.products.some((p) => p.id === incoming.id)) {
    s.products = s.products.map((p) => p.id === incoming.id ? { ...incoming, updatedAt: now } : p);
  } else {
    const id = incoming.id || nextId(s.products);
    const variants = (incoming.variants ?? []).map((v, idx) => ({
      ...v,
      id: v.id || idx + 1,
      productId: id
    }));
    s.products = [...s.products, { ...incoming, id, variants, createdAt: now, updatedAt: now, deletedAt: null }];
  }
  await save();
  res.json({ ok: true });
}

export async function adminSoftDeleteProduct(req: Request, res: Response) {
  const s = await getState();
  const id = Number(req.params.id);
  s.products = s.products.map((p) => p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p);
  await save();
  res.json({ ok: true });
}

export async function adminRestoreProduct(req: Request, res: Response) {
  const s = await getState();
  const id = Number(req.params.id);
  s.products = s.products.map((p) => p.id === id ? { ...p, deletedAt: null } : p);
  await save();
  res.json({ ok: true });
}

export async function adminToggleProductStatus(req: Request, res: Response) {
  const s = await getState();
  const id = Number(req.params.id);
  s.products = s.products.map((p) => p.id === id ? { ...p, status: p.status === "active" ? "inactive" : "active", updatedAt: new Date().toISOString() } : p);
  await save();
  res.json({ ok: true });
}

export async function adminSetVariantStock(req: Request, res: Response) {
  const s = await getState();
  const productId = Number(req.params.id);
  const variantId = Number(req.params.variantId);
  const stock = Math.max(0, Number(req.body?.stock ?? 0));
  s.products = s.products.map((p) => {
    if (p.id !== productId) return p;
    return { ...p, variants: p.variants.map((v) => v.id === variantId ? { ...v, stock } : v) };
  });
  await save();
  res.json({ ok: true });
}

// ---- categories ----

export async function adminListCategories(_req: Request, res: Response) {
  const s = await getState();
  res.json({ items: s.categories });
}

export async function adminUpsertCategory(req: Request, res: Response) {
  const s = await getState();
  const incoming = req.body as Category;
  if (incoming.id && s.categories.some((c) => c.id === incoming.id)) {
    s.categories = s.categories.map((c) => c.id === incoming.id ? { ...incoming } : c);
  } else {
    const id = incoming.id || nextId(s.categories);
    s.categories = [...s.categories, { ...incoming, id, deletedAt: null }];
  }
  await save();
  res.json({ ok: true });
}

export async function adminSoftDeleteCategory(req: Request, res: Response) {
  const s = await getState();
  const id = Number(req.params.id);
  const hasLinked = s.products.some((p) => !p.deletedAt && p.categoryId === id);
  if (hasLinked) return res.status(409).json({ ok: false, reason: "has-products" });
  s.categories = s.categories.map((c) => c.id === id ? { ...c, deletedAt: new Date().toISOString() } : c);
  await save();
  res.json({ ok: true });
}

export async function adminRestoreCategory(req: Request, res: Response) {
  const s = await getState();
  const id = Number(req.params.id);
  s.categories = s.categories.map((c) => c.id === id ? { ...c, deletedAt: null } : c);
  await save();
  res.json({ ok: true });
}

// ---- offers ----

export async function adminListOffers(_req: Request, res: Response) {
  const s = await getState();
  res.json({ items: s.offers });
}

export async function adminUpsertOffer(req: Request, res: Response) {
  const s = await getState();
  const incoming = req.body as Offer;
  const now = new Date().toISOString();
  if (incoming.id && s.offers.some((o) => o.id === incoming.id)) {
    s.offers = s.offers.map((o) => o.id === incoming.id ? { ...incoming, updatedAt: now } : o);
  } else {
    const id = incoming.id || nextId(s.offers);
    s.offers = [...s.offers, { ...incoming, id, createdAt: now, updatedAt: now, deletedAt: null }];
  }
  await save();
  res.json({ ok: true });
}

export async function adminSoftDeleteOffer(req: Request, res: Response) {
  const s = await getState();
  const id = Number(req.params.id);
  s.offers = s.offers.map((o) => o.id === id ? { ...o, deletedAt: new Date().toISOString() } : o);
  await save();
  res.json({ ok: true });
}

export async function adminRestoreOffer(req: Request, res: Response) {
  const s = await getState();
  const id = Number(req.params.id);
  s.offers = s.offers.map((o) => o.id === id ? { ...o, deletedAt: null } : o);
  await save();
  res.json({ ok: true });
}
