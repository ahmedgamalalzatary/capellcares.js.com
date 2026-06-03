import type {
  CheckoutRequestDto,
  Language as SharedLanguage,
  Order as SharedOrder,
  PaymentStatus as SharedPaymentStatus
} from "@capella/shared";

export type Language = SharedLanguage;
export type PaymentStatus = SharedPaymentStatus;

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
  status: "active" | "inactive";
  deletedAt: string | null;
  variants: Array<{
    id: string;
    sizeLabel: string;
    sellingPrice: number;
    stockQty: number;
  }>;
}

export type CheckoutPayload = CheckoutRequestDto;
export type Order = SharedOrder;
