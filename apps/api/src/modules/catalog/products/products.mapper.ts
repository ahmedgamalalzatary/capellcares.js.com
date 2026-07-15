import type { Product } from "@minikoshk/shared";

type ProductRow = {
  id: number;
  sku: string;
  slug: string;
  keywords: string[];
  imagePath: string | null;
  hoverImagePath?: string | null;
  media?: Array<{ type: "image" | "video"; url: string }>;
  youtubeUrl?: string | null;
  status: "active" | "inactive";
  isNew: boolean;
  isBestseller: boolean;
  categoryId: number;
  sizes: Product["sizes"];
  colors: Product["colors"];
  variants: Array<{
    id: number;
    productId: number;
    sizeId: number;
    colorId: number | null;
    price: number;
    stock: number;
    sortOrder: number;
  }>;
  name: { ar: string; en: string };
  description: { ar: string; en: string };
  ingredients: { ar: string; en: string };
  howToUse: { ar: string; en: string };
  warnings: { ar: string; en: string };
};

export function toStorefrontProduct(product: ProductRow): Omit<Product, "buyingPrice" | "createdAt" | "updatedAt"> {
  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    description: product.description,
    ingredients: product.ingredients,
    howToUse: product.howToUse,
    warnings: product.warnings,
    keywords: product.keywords,
    imagePath: product.imagePath ?? "",
    hoverImagePath: product.hoverImagePath ?? "",
    media: product.media ?? (product.imagePath ? [{ type: "image", url: product.imagePath }] : []),
    youtubeUrl: product.youtubeUrl ?? undefined,
    status: product.status,
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    categoryId: product.categoryId,
    sizes: product.sizes,
    colors: product.colors,
    variants: product.variants
  };
}
