import type { Order, OrderItem, OrderSummary } from "../types/index.js";
import type { CheckoutRequestDto } from "./checkout.dto.js";

export type OrderItemDto = OrderItem;
export type OrderDto = Order;

export interface AdminOrderDto extends Order {
  updatedAt: string;
  codExpiresAt: string | null;
}

export interface CreateOrderDto {
  checkout: CheckoutRequestDto["items"];
}

export type OrderSummaryDto = OrderSummary;
