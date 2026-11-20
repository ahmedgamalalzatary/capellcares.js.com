import type { ShopMediaTargetType } from "@capella/shared";

export type EditableItem = {
  id: string;
  arImagePath: string;
  arMobileImagePath: string;
  enImagePath: string;
  enMobileImagePath: string;
  targetType: ShopMediaTargetType;
  targetId: number | null;
};

/** A picture section being edited. `key` tells sections apart on the page: "top" for the top banner, a generated key for each custom picture section. */
export type EditableSection = {
  key: string;
  status: "active" | "inactive";
  items: EditableItem[];
};

/** One row of the custom sections list while it is edited. */
export type EditableCustomBlock =
  | { key: string; type: "category"; categoryId: number | null }
  | { key: string; type: "media"; mediaSectionId: number | null; section: EditableSection };

export type EditableAnnouncement = {
  id: string;
  arText: string;
  enText: string;
  status: "active" | "inactive";
};
