import type { NextFunction, Request, Response } from "express";
import { getStorefrontCollectionBySlug, listStorefrontCollections } from "./collections.service.js";
import type { LocalizedRequest } from "../../../middlewares/locale.middleware.js";

export async function listCollectionsController(req: Request, res: Response, next: NextFunction) {
  try {
    const lang = (req as LocalizedRequest).locale ?? "ar";
    const items = await listStorefrontCollections(lang);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function getCollectionBySlugController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (typeof slug !== "string" || slug.trim().length === 0) {
      return res.status(400).json({ message: "Invalid collection slug" });
    }
    const lang = (req as LocalizedRequest).locale ?? "ar";
    const collection = await getStorefrontCollectionBySlug(slug.trim(), lang); if (!collection) return res.status(404).json({ message: "Collection not found" });
    return res.json(collection);
  } catch (error) {
    next(error);
  }
}
