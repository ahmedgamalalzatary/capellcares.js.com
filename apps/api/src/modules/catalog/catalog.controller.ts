import type { Request, Response } from "express";
import { getState } from "../../data/file-store.js";

export async function listProducts(req: Request, res: Response) {
  const state = await getState();
  const { q, category, status } = req.query as { q?: string; category?: string; status?: string };
  let items = state.products.filter((p) => !p.deletedAt);
  if (status !== "all") items = items.filter((p) => p.status === "active");
  if (category) {
    const cat = state.categories.find((c) => c.slug === category && !c.deletedAt);
    if (cat) {
      const descendantIds = collectDescendantIds(state.categories, cat.id);
      items = items.filter((p) => descendantIds.has(p.categoryId));
    } else {
      items = [];
    }
  }
  if (q?.trim()) {
    const needle = q.trim().toLowerCase();
    items = items.filter((p) =>
      p.name.ar.toLowerCase().includes(needle) ||
      p.name.en.toLowerCase().includes(needle) ||
      p.sku.toLowerCase().includes(needle) ||
      p.keywords.some((k) => k.toLowerCase().includes(needle))
    );
  }
  res.json({ items });
}

export async function getProductBySlug(req: Request, res: Response) {
  const state = await getState();
  const product = state.products.find((p) => p.slug === req.params.slug && !p.deletedAt);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
}

export async function listCategories(_req: Request, res: Response) {
  const state = await getState();
  res.json({ items: state.categories.filter((c) => !c.deletedAt) });
}

export async function listOffers(_req: Request, res: Response) {
  const state = await getState();
  res.json({ items: state.offers.filter((o) => !o.deletedAt && o.status === "active") });
}

export async function getOfferBySlug(req: Request, res: Response) {
  const state = await getState();
  const offer = state.offers.find((o) => o.slug === req.params.slug && !o.deletedAt);
  if (!offer) return res.status(404).json({ message: "Offer not found" });
  res.json(offer);
}

function collectDescendantIds(categories: { id: number; parentId: number | null }[], rootId: number): Set<number> {
  const set = new Set<number>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) {
      if (c.parentId != null && set.has(c.parentId) && !set.has(c.id)) {
        set.add(c.id);
        changed = true;
      }
    }
  }
  return set;
}
