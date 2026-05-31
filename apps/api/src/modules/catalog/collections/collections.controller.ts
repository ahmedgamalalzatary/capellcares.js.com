import type { Request, Response } from "express";
import { getStorefrontCollectionBySlug, listStorefrontCollections } from "./collections.service.js";

export function listCollectionsController(_req: Request, res: Response) {
  listStorefrontCollections().then((items) => res.json({ items }));
}

export function getCollectionBySlugController(req: Request, res: Response) {
  getStorefrontCollectionBySlug(req.params.slug).then((collection) => {
    if (!collection) return res.status(404).json({ message: "Collection not found" });
    return res.json(collection);
  });
}
