export interface ProductSizeDto {
  id: number;
  productId: number;
  label: string;
  sortOrder: number;
}

export interface ProductColorDto {
  id: number;
  productId: number;
  hex: string;
  sortOrder: number;
}

export interface ProductVariantDto {
  id: number;
  productId: number;
  sizeId: number;
  colorId: number | null;
  price: number;
  stock: number;
  sortOrder: number;
}

export interface ProductMediaDto {
  type: "image" | "video";
  url: string;
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
  hoverImagePath: string | null;
  media: ProductMediaDto[];
  status: "active" | "inactive";
  isNew: boolean;
  isBestseller: boolean;
  categoryId: number;
  deletedAt: string | null;
  sizes: ProductSizeDto[];
  colors: ProductColorDto[];
  variants: ProductVariantDto[];
}
