import type { ShopMediaSection, ShopMediaTargetType } from "@capella/shared";
import type { EditableItem, EditableSection } from "@/features/shop-media/types";

export const MISSING_IMAGE_OR_TARGET_MESSAGE = "أضيفي صورة واحدة على الأقل وحددي الوجهة المطلوبة لكل عنصر قبل الحفظ.";
export const DELETED_TARGET_MESSAGE = "العنصر المرتبط بإحدى الصور محذوف. اختاري عنصرًا جديدًا قبل الحفظ.";

export function toEditableSection(section: ShopMediaSection | undefined, key: string): EditableSection {
  return {
    key,
    status: section?.status ?? "inactive",
    items: (section?.items ?? []).map((item) => ({
      id: String(item.id),
      arImagePath: item.arImagePath ?? "",
      arMobileImagePath: item.arMobileImagePath ?? "",
      enImagePath: item.enImagePath ?? "",
      enMobileImagePath: item.enMobileImagePath ?? "",
      targetType: item.targetType,
      targetId: item.targetId
    }))
  };
}

export function isDetailTargetType(targetType: ShopMediaTargetType) {
  return targetType === "product" || targetType === "offer" || targetType === "collection" || targetType === "category";
}

/** Why a picture section can't be saved yet, or null when it can: every image needs a picture and a chosen link, and a link to a deleted item must be replaced. */
export function findSectionError(section: EditableSection, hasMissingTarget: (item: EditableItem) => boolean): string | null {
  if (section.items.some((item) => (
    !item.arImagePath && !item.arMobileImagePath && !item.enImagePath && !item.enMobileImagePath
  ) || (isDetailTargetType(item.targetType) && item.targetId === null))) {
    return MISSING_IMAGE_OR_TARGET_MESSAGE;
  }
  if (section.items.some(hasMissingTarget)) {
    return DELETED_TARGET_MESSAGE;
  }
  return null;
}

/** A picture section's images as the API takes them, numbered in their shown order. */
export function toSectionItemsPayload(items: EditableItem[]) {
  return items.map((item, index) => ({
    arImagePath: item.arImagePath || null,
    arMobileImagePath: item.arMobileImagePath || null,
    enImagePath: item.enImagePath || null,
    enMobileImagePath: item.enMobileImagePath || null,
    targetType: item.targetType,
    targetId: isDetailTargetType(item.targetType) ? item.targetId : null,
    sortOrder: index + 1
  }));
}

/** A fresh, empty image row for a picture section. */
export function newEditableItem(): EditableItem {
  return {
    id: crypto.randomUUID(),
    arImagePath: "",
    arMobileImagePath: "",
    enImagePath: "",
    enMobileImagePath: "",
    targetType: "offers",
    targetId: null
  };
}
