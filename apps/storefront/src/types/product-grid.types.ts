import type { Category, Language, Product } from "@capella/shared";

export interface ProductGridProps {
  products: Product[];
  categories: Category[];
  lang: Language;
  dict: Record<
    string,
    | string
    | readonly string[]
    | Record<string, string | readonly string[] | Record<string, string>>
  >;
  initialSearch?: string;
  initialCategory?: number;
  initialCols?: 1 | 2;
  lockCategory?: boolean;
  headerCategoryIds?: number[];
  onHeaderCategoryIdsChange?: (value: number[]) => void;
}

export type Sort = "default" | "newest" | "price-asc" | "price-desc" | "name";

export interface PriceRange {
  min: string;
  max: string;
}

export interface CategoryTreeNode {
  category: Category;
  children: CategoryTreeNode[];
}
