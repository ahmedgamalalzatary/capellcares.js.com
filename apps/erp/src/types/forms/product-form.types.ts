import type { Category, Product } from "@capella/shared";
import type { RelatedOption } from "../../components/forms/related-items-field";

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
