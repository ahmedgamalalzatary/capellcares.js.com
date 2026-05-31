import type { Advice, Category, Offer, OrderSummary, Product, ProductMedia } from "@capella/shared";

export type Listener = () => void;
export type CategoryUpsertInput = Omit<Category, "id"> & { id?: number };
export type SalesSummary = {
  totalOrders: number;
  totalUnitsSold: number;
  totalRevenue: number;
};
export type SalesProductTotal = {
  productId: number;
  productName: string;
  unitsSold: number;
  revenue: number;
};
export type SalesVariantTotal = {
  variantId: number;
  productId: number;
  productName: string;
  variantLabel: string;
  unitsSold: number;
  revenue: number;
};
export type SalesOrderBreakdown = {
  orderId: number;
  orderCode: string;
  paymentStatus: "pending" | "accepted" | "denied";
  totalAmount: number;
  unitsSold: number;
  createdAt: string;
  items: Array<{ label: string; unitsSold: number }>;
};
export type SalesAnalytics = {
  summary: SalesSummary;
  productTotals: SalesProductTotal[];
  variantTotals: SalesVariantTotal[];
  orders: SalesOrderBreakdown[];
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
  name?: { ar?: string; en?: string };
  arName?: string;
  enName?: string;
  isLeaf?: boolean;
  deletedAt?: string | null;
};

export type ErpStoreSnapshot = {
  products: Product[];
  categories: Category[];
  offers: Offer[];
  advices: Advice[];
  orders: OrderSummary[];
  sales: SalesAnalytics;
  loaded: boolean;
  loading: boolean;
  error: string | null;
};
