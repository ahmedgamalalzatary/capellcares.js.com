import type { Category, EntityMedia, Offer, Product, RelatedItemRef } from "@capella/shared";
import type { RelatedOption } from "@/lib/related-options";

export interface OfferFormProps {
  mode: "new" | "edit";
  initial?: Offer;
  products: Product[];
  categories: Category[];
  relatedOptions?: RelatedOption[];
  relatedItemsAvailable?: boolean;
}

export interface OfferFormRow {
  id?: number;
  productId: number;
  variantId: number;
  qty: number;
}

/** A thing the offer needs before it can be saved live; `target` is the wizard step that owns it. */
export interface OfferRequirement {
  key: string;
  label: string;
  target: string;
  ok: boolean;
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
  youtubeUrl: string;
  setYoutubeUrl: (value: string) => void;
  media: EntityMedia[];
  setMedia: (value: EntityMedia[]) => void;
  arHoverImagePath: string;
  setArHoverImagePath: (value: string) => void;
  enHoverImagePath: string;
  setEnHoverImagePath: (value: string) => void;
  status: "active" | "inactive";
  setStatus: (value: "active" | "inactive") => void;
  categoryId: number | null;
  setCategoryId: (value: number | null) => void;
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
  save: (options?: { asStatus?: "active" | "inactive" }) => Promise<boolean>;
  requirements: OfferRequirement[];
  checkRequirements: (keys: string[]) => boolean;
  missing: OfferRequirement[];
  canPublish: boolean;
}
