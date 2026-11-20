import type { Request, Response } from "express";
import {
  listCustomMediaSectionIdsRepo,
  listShopCustomBlocksRepo,
  liveCategoriesExistRepo,
  replaceShopCustomBlocksRepo,
  type ShopCustomBlockInput
} from "../../shop-media/shop-media-section.repository.js";
import { normalizeShopMediaItems } from "../../shop-media/shop-media-items.js";
import { safeTriggerShopMediaRevalidation } from "./admin-shop-media.controller.js";

const INVALID_PAYLOAD = { error: "Invalid shop custom sections payload" };
const MAX_BLOCKS = 100;

function parsePositiveInt(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function listAdminShopCustomSectionsController(_req: Request, res: Response) {
  res.json({ items: await listShopCustomBlocksRepo() });
}

/** Saves the whole ordered list at once. A category may appear only once, and a picture section may only reuse an id that already belongs to the custom sections. */
export async function replaceAdminShopCustomSectionsController(req: Request, res: Response) {
  const rawBlocks = (req.body as { blocks?: unknown })?.blocks;
  if (!Array.isArray(rawBlocks) || rawBlocks.length > MAX_BLOCKS) {
    return res.status(400).json(INVALID_PAYLOAD);
  }

  const customMediaIds = await listCustomMediaSectionIdsRepo();
  const seenCategoryIds = new Set<number>();
  const seenMediaIds = new Set<number>();
  const blocks: ShopCustomBlockInput[] = [];

  for (const raw of rawBlocks as Array<Record<string, unknown> | null>) {
    if (raw?.type === "category") {
      const categoryId = parsePositiveInt(raw.categoryId);
      if (categoryId == null || seenCategoryIds.has(categoryId)) {
        return res.status(400).json(INVALID_PAYLOAD);
      }
      seenCategoryIds.add(categoryId);
      blocks.push({ type: "category", categoryId });
      continue;
    }

    if (raw?.type === "media") {
      if (raw.status !== "active" && raw.status !== "inactive") {
        return res.status(400).json(INVALID_PAYLOAD);
      }
      let mediaSectionId: number | null = null;
      if (raw.mediaSectionId != null && raw.mediaSectionId !== "") {
        mediaSectionId = parsePositiveInt(raw.mediaSectionId);
        if (mediaSectionId == null || !customMediaIds.has(mediaSectionId) || seenMediaIds.has(mediaSectionId)) {
          return res.status(400).json(INVALID_PAYLOAD);
        }
        seenMediaIds.add(mediaSectionId);
      }
      const items = await normalizeShopMediaItems(raw.items);
      if (items == null) {
        return res.status(400).json(INVALID_PAYLOAD);
      }
      blocks.push({ type: "media", mediaSectionId, status: raw.status, items });
      continue;
    }

    return res.status(400).json(INVALID_PAYLOAD);
  }

  if (!(await liveCategoriesExistRepo([...seenCategoryIds]))) {
    return res.status(400).json(INVALID_PAYLOAD);
  }

  await replaceShopCustomBlocksRepo(blocks);
  await safeTriggerShopMediaRevalidation();
  res.json({ ok: true, items: await listShopCustomBlocksRepo() });
}
