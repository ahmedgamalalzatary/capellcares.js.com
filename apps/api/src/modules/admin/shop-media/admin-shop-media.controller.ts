import type { Request, Response } from "express";
import {
  listShopMediaSectionsRepo,
  replaceShopMediaSectionRepo
} from "../../shop-media/shop-media-section.repository.js";
import { normalizeShopMediaItems } from "../../shop-media/shop-media-items.js";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";

// Only the top banner keeps a slot; the other picture sections live among the custom sections.
function parseSlot(value: unknown): 1 | null {
  return Number.parseInt(String(value), 10) === 1 ? 1 : null;
}

export async function safeTriggerShopMediaRevalidation() {
  try {
    await triggerStorefrontRevalidation({ entity: "shop-media" });
  } catch (error) {
    console.warn("Failed to trigger storefront revalidation for shop media", error);
  }
}

export async function listAdminShopMediaSectionsController(_req: Request, res: Response) {
  res.json({ items: await listShopMediaSectionsRepo() });
}

export async function updateAdminShopMediaSectionController(req: Request, res: Response) {
  const slot = parseSlot(req.params.slot);
  if (slot == null) {
    return res.status(400).json({ error: "Invalid shop media section slot" });
  }

  const input = req.body as { status?: unknown; items?: unknown };

  if (input.status !== "active" && input.status !== "inactive") {
    return res.status(400).json({ error: "Invalid shop media section payload" });
  }

  const normalizedItems = await normalizeShopMediaItems(input.items);
  if (normalizedItems == null) {
    return res.status(400).json({ error: "Invalid shop media section payload" });
  }

  await replaceShopMediaSectionRepo(slot, input.status, normalizedItems);
  await safeTriggerShopMediaRevalidation();
  res.json({ ok: true });
}
