import type { Request, Response } from "express";
import type { LocalizedRequest } from "../../../middlewares/locale.middleware.js";
import { getStorefrontProductBySlug, listStorefrontProducts } from "./products.service.js";

export function listProductsController(req: Request, res: Response) {
  const lang = (req as LocalizedRequest).locale ?? "ar";
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  listStorefrontProducts({ lang, q, category }).then((items) => res.json({ items }));
}

export function getProductBySlugController(req: Request, res: Response) {
  getStorefrontProductBySlug(req.params.slug).then((product) => {
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.json(product);
  });
}
