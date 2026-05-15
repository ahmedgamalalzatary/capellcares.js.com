import type { CheckoutItemDto } from "./checkout.dto.js";

export interface OrderItemDto {
  id: number;
  orderId: number;
  itemType: "product_variant" | "offer";
  variantId: number | null;
  offerId: number | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  snapshotNameAr: string | null;
  snapshotNameEn: string | null;
  snapshotSizeLabel: string | null;
}

export interface OrderDto {
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
  notes: string | null;
  paymentMethod: "cod";
  paymentStatus: "pending" | "paid" | "failed";
  totalAmount: number;
  items: OrderItemDto[];
}

export interface CreateOrderDto {
  checkout: CheckoutItemDto[];
}
