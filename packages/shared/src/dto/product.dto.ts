export interface ProductVariantDto {
  id: number;
  productId: number;
  sizeLabel: string;
  sellingPrice: number;
  stockQty: number;
  sortOrder: number;
}

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
  status: "active" | "inactive";
  isNew: boolean;
  isBestseller: boolean;
  categoryId: number;
  deletedAt: string | null;
  variants: ProductVariantDto[];
}
