import type { Order, OrderItem, OrderSummary } from "../types/index.js";
import type { CheckoutRequestDto } from "./checkout.dto.js";

export type OrderItemDto = OrderItem;
export type OrderDto = Order;

export interface CreateOrderDto {
  checkout: CheckoutRequestDto["items"];
}

export interface CreateErpSaleDto {
  fullName: string;
  phone: string;
  addressLine: string;
  notes?: string;
  soldTotalAmount: number;
  items: CheckoutRequestDto["items"];
}

export type OrderSummaryDto = OrderSummary;
