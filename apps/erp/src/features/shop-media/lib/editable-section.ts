import type { ShopMediaSection, ShopMediaTargetType } from "@capella/shared";
import type { EditableSection } from "@/features/shop-media/types";

export function toEditableSection(section: ShopMediaSection | undefined, slot: 1 | 2 | 3 | 4 | 5): EditableSection {
  return {
    slot,
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
