import type { Offer, Product, RelatedItemRef } from "@capella/shared";
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

export interface OfferFormBreakdownRow {
  product?: Product;
  variant?: Product["variants"][number];
  subtotal: number;
  row: OfferFormRow;
}

export interface OfferFormComputed {
  originalTotal: number;
  breakdown: OfferFormBreakdownRow[];
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
  image: string | null;
  setImage: (value: string | null) => void;
  rows: OfferFormRow[];
  relatedItems: RelatedItemRef[] | undefined;
  setRelatedItems: (value: RelatedItemRef[] | undefined) => void;
  errors: Record<string, string>;
  relatedSelectableOptions: RelatedOption[];
  computed: OfferFormComputed;
  addRow: () => void;
  removeRow: (index: number) => void;
  updateRow: (index: number, patch: Partial<OfferFormRow>) => void;
  save: () => Promise<boolean>;
}
