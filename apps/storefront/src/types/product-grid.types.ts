import type { Category, Language, Product } from "@capella/shared";

export interface ProductGridProps {
  products: Product[];
  categories: Category[];
  lang: Language;
  dict: Record<string, string | Record<string, string | Record<string, string>>>;
  initialSearch?: string;
  initialCategory?: number;
  lockCategory?: boolean;
}

export type Sort = "newest" | "price-asc" | "price-desc" | "name";

export interface PriceRange {
  min: string;
  max: string;
}

export interface CategoryTreeItem {
  parent: Category;
  children: Category[];
}
