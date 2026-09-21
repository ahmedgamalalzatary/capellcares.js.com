import type { Order, OrderItem, OrderSummary } from "../types/index.js";
import type { CheckoutRequestDto } from "./checkout.dto.js";

export type OrderItemDto = OrderItem;
export type OrderDto = Order;

/** Payment references for ERP support; never includes checkout credentials. */
export interface AdminOrderPaymentDto {
  attemptNumber: number;
  merchantReference: string;
  environment: "test" | "live";
  paymentMethod: "card" | "wallet" | null;
  integrationId: number | null;
  paymobOrderId: string | null;
  paymobTransactionId: string | null;
  createdAt: string;
}

export interface AdminOrderDto extends Order {
  updatedAt: string;
  codExpiresAt: string | null;
  payment: AdminOrderPaymentDto | null;
}

export interface CreateOrderDto {
  checkout: CheckoutRequestDto["items"];
}

export type OrderSummaryDto = OrderSummary;
