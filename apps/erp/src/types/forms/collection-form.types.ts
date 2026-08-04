import type { Category, Collection, EntityMedia, Product, RelatedItemRef } from "@capella/shared";
import type { RelatedOption } from "../../components/forms/related-items-field";

export interface CollectionFormProps {
  mode: "new" | "edit";
  initial?: Collection;
  products: Product[];
  categories: Category[];
  relatedOptions?: RelatedOption[];
  relatedItemsAvailable?: boolean;
}

export interface CollectionFormRow {
  id?: number;
  productId: number;
  variantId: number;
  qty: number;
}

export interface UseCollectionFormResult {
  nameAr: string;
  setNameAr: (value: string) => void;
  nameEn: string;
  setNameEn: (value: string) => void;
  descAr: string;
  setDescAr: (value: string) => void;
  descEn: string;
  setDescEn: (value: string) => void;
  price: number;
  setPrice: (value: number) => void;
  media: EntityMedia[];
  setMedia: (value: EntityMedia[]) => void;
  categoryId: number | null;
  setCategoryId: (value: number | null) => void;
  rows: CollectionFormRow[];
  relatedItems: RelatedItemRef[] | undefined;
  setRelatedItems: (value: RelatedItemRef[] | undefined) => void;
  errors: Record<string, string>;
  relatedSelectableOptions: RelatedOption[];
  originalTotal: number;
  addRow: () => void;
  removeRow: (index: number) => void;
  moveRow: (index: number, direction: -1 | 1) => void;
  updateRow: (index: number, patch: Partial<CollectionFormRow>) => void;
  save: () => Promise<boolean>;
}
