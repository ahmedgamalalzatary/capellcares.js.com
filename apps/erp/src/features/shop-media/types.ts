import type { ShopMediaTargetType, ShopPageBuiltInBlockType } from "@capella/shared";

export type EditableItem = {
  id: string;
  arImagePath: string;
  arMobileImagePath: string;
  enImagePath: string;
  enMobileImagePath: string;
  targetType: ShopMediaTargetType;
  targetId: number | null;
};

/** A picture section being edited. `key` tells sections apart on the page. */
export type EditableSection = {
  key: string;
  status: "active" | "inactive";
  items: EditableItem[];
};

/** One section of the shop page layout while it is edited. */
export type EditableShopBlock =
  | { key: string; type: ShopPageBuiltInBlockType }
  | { key: string; type: "category"; categoryId: number | null }
  | { key: string; type: "media"; mediaSectionId: number | null; section: EditableSection };

export type EditableAnnouncement = {
  id: string;
  arText: string;
  enText: string;
  status: "active" | "inactive";
};
