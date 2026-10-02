import type { Request, Response } from "express";
import { listActiveShopMediaSectionsRepo } from "./shop-media-section.repository.js";

export async function listStorefrontShopMediaSectionsController(_req: Request, res: Response) {
  res.json({ items: await listActiveShopMediaSectionsRepo() });
}
