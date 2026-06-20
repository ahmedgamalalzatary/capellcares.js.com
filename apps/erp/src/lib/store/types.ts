import type { Advice, Category, Collection, Offer, OrderSummary, Product, ProductMedia, ShopMediaSection } from "@capella/shared";

export type Listener = () => void;
export type CategoryUpsertInput = Omit<Category, "id"> & { id?: number };
export type SalesAnalytics = {
  summary: {
    totalOrders: number;
    totalUnitsSold: number;
    totalRevenue: number;
  };
  productTotals: Array<{
    productId: number;
    productName: string;
    unitsSold: number;
    revenue: number;
  }>;
  variantTotals: Array<{
    variantId: number;
    productId: number;
    productName: string;
    variantLabel: string;
    unitsSold: number;
    revenue: number;
  }>;
  orders: Array<{
    orderId: number;
    orderCode: string;
    paymentStatus: "pending" | "accepted" | "denied";
    totalAmount: number;
    unitsSold: number;
    createdAt: string;
    items: Array<{ label: string; unitsSold: number }>;
  }>;
};
export type ProductApiShape = {
  id: number;
  sku?: string;
  slug?: string;
  name?: { ar?: string; en?: string };
  arName?: string;
  enName?: string;
  description?: { ar?: string; en?: string };
  arDescription?: string | null;
  enDescription?: string | null;
  ingredients?: { ar?: string; en?: string };
  arIngredients?: string | null;
  enIngredients?: string | null;
  howToUse?: { ar?: string; en?: string };
  arHowToUse?: string | null;
  enHowToUse?: string | null;
  warnings?: { ar?: string; en?: string };
  arWarnings?: string | null;
  enWarnings?: string | null;
  keywords?: string[] | string;
  buyingPrice?: number | string;
  imagePath?: string | null;
  hoverImagePath?: string | null;
  media?: ProductMedia[];
  youtubeUrl?: string | null;
  status?: "active" | "inactive";
  categoryId?: number | string;
  variants?: Array<{
    id?: number | string;
    productId?: number | string;
    size?: string;
    sizeLabel?: string;
    price?: number | string;
    sellingPrice?: number | string;
    stock?: number | string;
    stockQty?: number | string;
    sortOrder?: number | string;
  }>;
  offerIds?: Array<number | string>;
  sortOrder?: number;
  orderings?: Array<{ scopeType?: string; scopeId?: number | null; rank?: number }>;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  isNew?: boolean;
  isBestseller?: boolean;
};
export type CategoryApiShape = {
  id: number;
  parentId: number | null;
  slug: string;
  imagePath?: string | null;
  sortOrder?: number;
  createdAt?: string;
  name?: { ar?: string; en?: string };
  arName?: string;
  enName?: string;
  isLeaf?: boolean;
  deletedAt?: string | null;
};

export type ErpStoreSnapshot = {
  products: Product[];
  categories: Category[];
  collections: Collection[];
  offers: Offer[];
  advices: Advice[];
  shopMediaSections: ShopMediaSection[];
  orders: OrderSummary[];
  sales: SalesAnalytics;
  loaded: boolean;
  loading: boolean;
  error: string | null;
};
