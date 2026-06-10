import type { Request, Response } from "express";
import type { LocalizedRequest } from "../../../middlewares/locale.middleware.js";
import { getStorefrontProductBySlug, listStorefrontProducts } from "./products.service.js";

export async function listProductsController(req: Request, res: Response) {
  const lang = (req as LocalizedRequest).locale ?? "ar";
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const items = await listStorefrontProducts({ lang, q, category });
  res.json({ items });
}

export async function getProductBySlugController(req: Request, res: Response) {
  const product = await getStorefrontProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ message: "Product not found" });
  return res.json(product);
}
