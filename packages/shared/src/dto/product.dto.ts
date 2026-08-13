export interface ProductVariantDto {
  id: number;
  productId: number;
  sizeLabel: string;
  sellingPrice: number;
  stockQty: number;
  sortOrder: number;
  discount?: VariantDiscountDto | null;
}

export interface VariantDiscountDto {
  id: number;
  variantId: number;
  type: "percentage" | "fixed";
  value: number;
  startsAt: string;
  endsAt: string;
  status: "active" | "inactive";
}

export type EntityMediaDto =
  | { type: "image"; arUrl: string | null; enUrl: string | null }
  | { type: "video"; url: string };

/** @deprecated Use EntityMediaDto. */
export type ProductMediaDto = EntityMediaDto;

export interface ProductDto {
  id: number;
  sku: string;
  slug: string;
  arName: string;
  enName: string;
  buyingPrice: number;
  keywords: string[];
  arDescription: string | null;
  enDescription: string | null;
  arIngredients: string | null;
  enIngredients: string | null;
  arHowToUse: string | null;
  enHowToUse: string | null;
  arWarnings: string | null;
  enWarnings: string | null;
  youtubeUrl: string | null;
  imagePath: string | null;
  hoverImagePath: string | null;
  arHoverImagePath?: string | null;
  enHoverImagePath?: string | null;
  media: EntityMediaDto[];
  status: "active" | "inactive";
  isNew: boolean;
  isBestseller: boolean;
  categoryId: number;
  deletedAt: string | null;
  variants: ProductVariantDto[];
}
