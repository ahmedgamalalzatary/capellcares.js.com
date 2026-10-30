import type { Category, Dict, Language, Product } from "@capella/shared";

export interface ProductGridProps {
  products: Product[];
  categories: Category[];
  /** Full hierarchy lookup for matching and card labels when `categories` is a scoped subtree. */
  categoryLookupCategories?: Category[];
  lang: Language;
  dict: Dict;
  initialSearch?: string;
  initialCategory?: number;
  initialCols?: 1 | 2;
  lockCategory?: boolean;
  headerCategoryIds?: number[];
  onHeaderCategoryIdsChange?: (value: number[]) => void;
  /** Set by pages that already stand for one category (category pages), so the filter panel names its catch-all pill after that category instead of offering a generic "all categories" that would duplicate the tree root. */
  scopedCategoryId?: number;
  /** Filters this page already stands for (a brand page has no use for a brand filter). */
  hiddenAttributeFilters?: AttributeFilterKey[];
}

export type AttributeFilterKey = "brand" | "age" | "character";

export interface AttributeFilterGroup {
  key: AttributeFilterKey;
  label: string;
  options: { id: number; label: string }[];
  selected: number[];
  toggle: (id: number) => void;
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
