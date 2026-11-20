import type { Request, Response } from "express";
import { shopPageBuiltInBlockTypes } from "@capella/database/drizzle/schema";
import {
  listShopMediaSectionIdsRepo,
  listShopPageBlocksRepo,
  liveCategoriesExistRepo,
  replaceShopPageBlocksRepo,
  type ShopPageBlockInput
} from "../../shop-media/shop-media-section.repository.js";
import { normalizeShopMediaItems } from "../../shop-media/shop-media-items.js";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";

const INVALID_PAYLOAD = { error: "Invalid shop layout payload" };
const MAX_BLOCKS = 100;

type BuiltInBlockType = (typeof shopPageBuiltInBlockTypes)[number];

function isBuiltInBlockType(value: unknown): value is BuiltInBlockType {
  return (shopPageBuiltInBlockTypes as readonly unknown[]).includes(value);
}

function parsePositiveInt(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function safeTriggerShopMediaRevalidation() {
  try {
    await triggerStorefrontRevalidation({ entity: "shop-media" });
  } catch (error) {
    console.warn("Failed to trigger storefront revalidation for shop media", error);
  }
}

export async function listAdminShopLayoutController(_req: Request, res: Response) {
  res.json({ items: await listShopPageBlocksRepo() });
}

/**
 * Saves the whole shop page at once. It needs at least one section; each built-in section and each category may appear
 * only once, and a picture section may only reuse an id that exists (each picture section has one place on the page).
 */
export async function replaceAdminShopLayoutController(req: Request, res: Response) {
  const rawBlocks = (req.body as { blocks?: unknown })?.blocks;
  if (!Array.isArray(rawBlocks) || rawBlocks.length === 0 || rawBlocks.length > MAX_BLOCKS) {
    return res.status(400).json(INVALID_PAYLOAD);
  }

  const mediaIds = await listShopMediaSectionIdsRepo();
  const seenBuiltIns = new Set<BuiltInBlockType>();
  const seenCategoryIds = new Set<number>();
  const seenMediaIds = new Set<number>();
  const blocks: ShopPageBlockInput[] = [];

  for (const raw of rawBlocks as Array<Record<string, unknown> | null>) {
    if (isBuiltInBlockType(raw?.type)) {
      if (seenBuiltIns.has(raw.type)) {
        return res.status(400).json(INVALID_PAYLOAD);
      }
      seenBuiltIns.add(raw.type);
      blocks.push({ type: raw.type });
      continue;
    }

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
        if (mediaSectionId == null || !mediaIds.has(mediaSectionId) || seenMediaIds.has(mediaSectionId)) {
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

  await replaceShopPageBlocksRepo(blocks);
  await safeTriggerShopMediaRevalidation();
  res.json({ ok: true, items: await listShopPageBlocksRepo() });
}
