import type { Category, Collection, EntityMedia, Offer, Product, RelatedItemRef } from "@capella/shared";
import type { RelatedOption } from "@/lib/related-options";

export type BundleKind = "offer" | "collection";

/** The offer/collection fields the shared bundle form and hook read. */
export interface BundleEntity {
  id: number;
  slug: string;
  name: { ar: string; en: string };
  description: { ar: string; en: string };
  youtubeUrl?: string;
  imagePath: string;
  media?: EntityMedia[];
  price: number;
  originalTotal: number;
  categoryId: number | null;
  items: Array<{ id?: number; variantId: number; qty: number }>;
  stock: number;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  relatedItems?: RelatedItemRef[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  arHoverImagePath?: string | null;
  enHoverImagePath?: string | null;
  hoverImagePath?: string;
}

export interface BundleFormRow {
  id?: number;
  productId: number;
  variantId: number;
  qty: number;
}

/** Something the bundle needs before it can be saved live; `target` is the wizard step that owns it. */
export interface BundleRequirement {
  key: string;
  label: string;
  target: string;
  ok: boolean;
}

export interface BundleFormProps<TBundle extends BundleEntity = BundleEntity> {
  mode: "new" | "edit";
  initial?: TBundle;
  products: Product[];
  categories: Category[];
  relatedOptions?: RelatedOption[];
  relatedItemsAvailable?: boolean;
}

/** The object `save` sends to the entity's upsert endpoint. */
export interface BundleSavePayload {
  id?: number;
  slug: string;
  name: { ar: string; en: string };
  description: { ar: string; en: string };
  youtubeUrl?: string;
  imagePath: string;
  hoverImagePath: string;
  arHoverImagePath: string | null;
  enHoverImagePath: string | null;
  media: EntityMedia[];
  price: number;
  originalTotal: number;
  categoryId: number;
  stock: number;
  items: Array<{ id?: number; variantId: number; qty: number }>;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  relatedItems?: RelatedItemRef[];
}

export interface UseBundleFormResult {
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
  rows: BundleFormRow[];
  relatedItems: RelatedItemRef[] | undefined;
  setRelatedItems: (value: RelatedItemRef[] | undefined) => void;
  errors: Record<string, string>;
  relatedSelectableOptions: RelatedOption[];
  originalTotal: number;
  addRow: () => void;
  removeRow: (index: number) => void;
  moveRow: (index: number, direction: -1 | 1) => void;
  updateRow: (index: number, patch: Partial<BundleFormRow>) => void;
  save: (options?: { asStatus?: "active" | "inactive" }) => Promise<boolean>;
  requirements: BundleRequirement[];
  checkRequirements: (keys: string[]) => boolean;
  missing: BundleRequirement[];
  canPublish: boolean;
}

/** The entity types a bundle config can describe. */
export type BundleSourceEntity = Offer | Collection;
