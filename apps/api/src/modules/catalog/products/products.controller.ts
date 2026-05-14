import type { Request, Response } from "express";
import { getStorefrontProductBySlug, listStorefrontProducts } from "./products.service.js";

export function listProductsController(req: Request, res: Response) {
  const lang = req.locale ?? "ar";
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  res.json({ items: listStorefrontProducts({ lang, q, category }) });
}

export function getProductBySlugController(req: Request, res: Response) {
  const product = getStorefrontProductBySlug(req.params.slug);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  return res.json(product);
}
