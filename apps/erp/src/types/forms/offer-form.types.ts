import type { EntityMedia, Offer, Product, RelatedItemRef } from "@capella/shared";
import type { RelatedOption } from "../../components/forms/related-items-field";

export interface OfferFormProps {
  mode: "new" | "edit";
  initial?: Offer;
  products: Product[];
  relatedOptions?: RelatedOption[];
  relatedItemsAvailable?: boolean;
}

export interface OfferFormRow {
  id?: number;
  productId: number;
  variantId: number;
  qty: number;
}

export interface UseOfferFormResult {
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
  rows: OfferFormRow[];
  relatedItems: RelatedItemRef[] | undefined;
  setRelatedItems: (value: RelatedItemRef[] | undefined) => void;
  errors: Record<string, string>;
  relatedSelectableOptions: RelatedOption[];
  computed: {
    originalTotal: number;
    breakdown: Array<{
      product?: Product;
      variant?: Product["variants"][number];
      subtotal: number;
      row: OfferFormRow;
    }>;
  };
  addRow: () => void;
  removeRow: (index: number) => void;
  moveRow: (index: number, direction: -1 | 1) => void;
  updateRow: (index: number, patch: Partial<OfferFormRow>) => void;
  save: () => Promise<boolean>;
}
