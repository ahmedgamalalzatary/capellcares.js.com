import type { Category, Product, RelatedItemRef } from "@capella/shared";
import type { RelatedOption } from "../related-items-field";

export interface ProductFormProps {
  mode: "new" | "edit";
  initial?: Product;
  categories: Category[];
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

export type ProductFormSavePayload = Product & {
  relatedItems?: RelatedItemRef[];
};
