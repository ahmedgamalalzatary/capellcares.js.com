import type { Category, Dict, Language, Product } from "@capella/shared";

export interface ProductGridProps {
  products: Product[];
  categories: Category[];
  lang: Language;
  dict: Dict;
  initialSearch?: string;
  initialCategory?: number;
  initialCols?: 1 | 2;
  lockCategory?: boolean;
  headerCategoryIds?: number[];
  onHeaderCategoryIdsChange?: (value: number[]) => void;
  /**
   * Set by pages that already stand for one category (category pages), so the
   * filter panel names its catch-all pill after that category instead of
   * offering a generic "all categories" that would duplicate the tree root.
   */
  scopedCategoryId?: number;
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
