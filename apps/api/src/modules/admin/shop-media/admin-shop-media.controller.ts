import type { Request, Response } from "express";
import {
  listShopMediaSectionsRepo,
  replaceShopMediaSectionRepo,
  shopMediaTargetExists
} from "../../../repositories/shop-media-section.repository.js";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";
import { isDetailTargetType, isListingTargetType, shopMediaTargetTypes } from "../../shop-media/shop-media.shared.js";

function sanitizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUploadPath(value: string) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // Non-URL strings are handled below.
  }

  return value || null;
}

function parseSlot(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const slot = Number.parseInt(String(value), 10);
  return slot === 1 || slot === 2 || slot === 3 || slot === 4 || slot === 5 ? slot : null;
}

async function safeTriggerShopMediaRevalidation() {
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

  const input = req.body as {
    status?: unknown;
    items?: Array<{ imagePath?: unknown; mobileImagePath?: unknown; targetType?: unknown; targetId?: unknown; sortOrder?: unknown }>;
  };

  if (input.status !== "active" && input.status !== "inactive") {
    return res.status(400).json({ error: "Invalid shop media section payload" });
  }

  if (!Array.isArray(input.items)) {
    return res.status(400).json({ error: "Invalid shop media section payload" });
  }

  const normalizedItems = [];
  for (const rawItem of input.items) {
    const imagePath = normalizeUploadPath(sanitizeString(rawItem?.imagePath));
    const mobileImagePath = normalizeUploadPath(sanitizeString(rawItem?.mobileImagePath));
    const targetType = sanitizeString(rawItem?.targetType);
    const targetIdValue = rawItem?.targetId;
    const sortOrder = Number.parseInt(String(rawItem?.sortOrder ?? 0), 10);

    if (
      (!imagePath && !mobileImagePath)
      || !shopMediaTargetTypes.includes(targetType as (typeof shopMediaTargetTypes)[number])
      || !Number.isFinite(sortOrder)
    ) {
      return res.status(400).json({ error: "Invalid shop media section payload" });
    }

    if (isListingTargetType(targetType)) {
      if (targetIdValue != null && targetIdValue !== "") {
        return res.status(400).json({ error: "Invalid shop media section payload" });
      }
      normalizedItems.push({ imagePath, mobileImagePath, targetType, targetId: null, sortOrder });
      continue;
    }

    if (!isDetailTargetType(targetType)) {
      return res.status(400).json({ error: "Invalid shop media section payload" });
    }

    const targetId = Number.parseInt(String(targetIdValue), 10);
    if (!Number.isInteger(targetId) || targetId <= 0 || !(await shopMediaTargetExists(targetType, targetId))) {
      return res.status(400).json({ error: "Invalid shop media section payload" });
    }

    normalizedItems.push({ imagePath, mobileImagePath, targetType, targetId, sortOrder });
  }

  await replaceShopMediaSectionRepo(slot, input.status, normalizedItems);
  await safeTriggerShopMediaRevalidation();
  res.json({ ok: true });
}
