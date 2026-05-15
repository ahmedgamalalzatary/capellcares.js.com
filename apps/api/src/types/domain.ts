export type Language = "ar" | "en";
export type ProductStatus = "active" | "inactive";
export type PaymentMethod = "cod";
export type PaymentStatus = "pending" | "paid" | "failed";

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
  categorySlug: string;
  status: ProductStatus;
  deletedAt: string | null;
  variants: ProductVariant[];
}

export interface CheckoutItem {
  type: "product" | "offer";
  variantId?: number;
  offerId?: number;
  qty: number;
}

export interface CheckoutPayload {
  fullName: string;
  phone: string;
  email: string;
  governorate: string;
  cityArea: string;
  addressLine: string;
  buildingApartment: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  items: CheckoutItem[];
  customerId?: number | null;
}

export interface Order {
  id: number;
  customerType: "guest" | "registered";
  customerId: number | null;
  fullName: string;
  phone: string;
  email: string;
  governorate: string;
  cityArea: string;
  addressLine: string;
  buildingApartment: string;
  notes: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  createdAt: string;
  items: Array<{ variantId: string; qty: number; unitPrice: number; lineTotal: number }>;
}
