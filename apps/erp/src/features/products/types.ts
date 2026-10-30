import type { Category, Product, ProductAttribute, Supplier } from "@capella/shared";
import type { RelatedOption } from "@/lib/related-options";

export interface ProductAttributeOptions {
  brands: ProductAttribute[];
  characters: ProductAttribute[];
  ageGroups: ProductAttribute[];
  suppliers: Supplier[];
}

export interface ProductFormProps {
  mode: "new" | "edit";
  initial?: Product;
  categories: Category[];
  attributes?: ProductAttributeOptions;
  relatedOptions?: RelatedOption[];
  relatedItemsAvailable?: boolean;
}

export type Requirement = {
  key: string;
  label: string;
  target: string;
  ok: boolean;
};

export type ProductFormErrors = Record<string, string>;
