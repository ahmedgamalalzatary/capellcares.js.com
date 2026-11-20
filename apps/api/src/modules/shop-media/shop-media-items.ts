import { shopMediaTargetExists, type ShopMediaSectionItemInput } from "./shop-media-section.repository.js";
import { isDetailTargetType, isListingTargetType, shopMediaTargetTypes } from "./shop-media.shared.js";

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

/** Checks and cleans the pictures of one picture section (the top banner or a custom one). Returns null when any picture is invalid: no image at all, an unknown link type, or a link to a missing or deleted item. */
export async function normalizeShopMediaItems(rawItems: unknown): Promise<ShopMediaSectionItemInput[] | null> {
  if (!Array.isArray(rawItems)) {
    return null;
  }

  const normalizedItems: ShopMediaSectionItemInput[] = [];
  for (const rawItem of rawItems as Array<Record<string, unknown> | null | undefined>) {
    const arImagePath = normalizeUploadPath(sanitizeString(rawItem?.arImagePath));
    const arMobileImagePath = normalizeUploadPath(sanitizeString(rawItem?.arMobileImagePath));
    const enImagePath = normalizeUploadPath(sanitizeString(rawItem?.enImagePath));
    const enMobileImagePath = normalizeUploadPath(sanitizeString(rawItem?.enMobileImagePath));
    const targetType = sanitizeString(rawItem?.targetType);
    const targetIdValue = rawItem?.targetId;
    const sortOrder = Number.parseInt(String(rawItem?.sortOrder ?? 0), 10);

    if (
      (!arImagePath && !arMobileImagePath && !enImagePath && !enMobileImagePath)
      || !shopMediaTargetTypes.includes(targetType as (typeof shopMediaTargetTypes)[number])
      || !Number.isFinite(sortOrder)
    ) {
      return null;
    }

    if (isListingTargetType(targetType)) {
      if (targetIdValue != null && targetIdValue !== "") {
        return null;
      }
      normalizedItems.push({ arImagePath, arMobileImagePath, enImagePath, enMobileImagePath, targetType, targetId: null, sortOrder });
      continue;
    }

    if (!isDetailTargetType(targetType)) {
      return null;
    }

    const targetId = Number.parseInt(String(targetIdValue), 10);
    if (!Number.isInteger(targetId) || targetId <= 0 || !(await shopMediaTargetExists(targetType, targetId))) {
      return null;
    }

    normalizedItems.push({ arImagePath, arMobileImagePath, enImagePath, enMobileImagePath, targetType, targetId, sortOrder });
  }

  return normalizedItems;
}
