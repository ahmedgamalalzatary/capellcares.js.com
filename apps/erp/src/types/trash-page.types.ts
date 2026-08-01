type TrashTab = "products" | "categories" | "offers" | "reviews";

export interface TrashListRow {
  id: number;
  title: string;
  subtitle: string;
  meta: string;
}

export interface TrashTabConfig {
  id: TrashTab;
  label: string;
  count: number;
}

export interface HardDeleteTarget {
  kind: TrashTab;
  id: number;
  title: string;
}

export type { TrashTab };
