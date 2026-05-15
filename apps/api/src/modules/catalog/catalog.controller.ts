import type { Request, Response } from "express";
import { listCategoriesRepo } from "../../repositories/category.repository.js";
import { findOfferBySlugRepo, listVisibleOffersRepo } from "../../repositories/offer.repository.js";
import { findVisibleProductBySlug, findVisibleProducts } from "../../repositories/product.repository.js";

export async function listProducts(req: Request, res: Response) {
  const { q, category } = req.query as { q?: string; category?: string };
  const items = await findVisibleProducts({ lang: "ar", q, category });
  res.json({ items });
}

export async function getProductBySlug(req: Request, res: Response) {
  const product = await findVisibleProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
}

export async function listCategories(_req: Request, res: Response) {
  const items = await listCategoriesRepo(false);
  res.json({ items });
}

export async function listOffers(_req: Request, res: Response) {
  const items = await listVisibleOffersRepo();
  res.json({ items });
}

export async function getOfferBySlug(req: Request, res: Response) {
  const offer = await findOfferBySlugRepo(req.params.slug);
  if (!offer) return res.status(404).json({ message: "Offer not found" });
  res.json(offer);
}
