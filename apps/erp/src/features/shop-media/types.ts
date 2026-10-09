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

export type EditableSection = {
  slot: 1 | 2 | 3 | 4 | 5;
  status: "active" | "inactive";
  items: EditableItem[];
};

export type EditableAnnouncement = {
  id: string;
  arText: string;
  enText: string;
  status: "active" | "inactive";
};
