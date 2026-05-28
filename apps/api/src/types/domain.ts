import type {
  CheckoutRequestDto,
  Language as SharedLanguage,
  Order as SharedOrder,
  PaymentMethod as SharedPaymentMethod,
  PaymentStatus as SharedPaymentStatus,
  ProductStatus as SharedProductStatus
} from "@capella/shared";

export type Language = SharedLanguage;
export type ProductStatus = SharedProductStatus;
export type PaymentMethod = SharedPaymentMethod;
export type PaymentStatus = SharedPaymentStatus;

export interface ProductVariant {
  id: string;
  sizeLabel: string;
  sellingPrice: number;
  stockQty: number;
}

export interface Product {
  id: number;
  slug: string;
  sku: string;
  arName: string;
  enName: string;
  arDescription?: string;
  enDescription?: string;
  keywords: string[];
  imagePath?: string;
  hoverImagePath?: string;
  categorySlug: string;
  status: ProductStatus;
  deletedAt: string | null;
  variants: ProductVariant[];
}

export type CheckoutItem = CheckoutRequestDto["items"][number];
export type CheckoutPayload = CheckoutRequestDto;
export type Order = SharedOrder;
