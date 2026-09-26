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
  shipping?: AdminOrderShippingStateDto | null;
}

type ManualShippingState = "preparing" | "ready_for_pickup" | "printed" | "delivered" | "returned";
export interface AdminOrderShippingStateDto {
  manualState: ManualShippingState | null;
  carrierState: "created" | "picked_up" | "in_transit" | "delivered" | "returned" | "cancelled" | "exception" | null;
  rawProviderCode: number | null;
  rawProviderType: string | null;
  custodyState: "unknown" | "carrier" | "recipient" | "warehouse_uninspected";
  collection: { confirmed: boolean; amountCents: number | null };
  processing: { startedAtMs: number | null; pickupAtMs: number | null; addressBlockedAtMs: number | null; untouchedExpiryApplies: boolean };
  history: { id: number; state: ManualShippingState; actorType: "staff" | "system"; actorId: number | null; atMs: number; reason: string | null }[];
}

export interface CreateOrderDto {
  checkout: CheckoutRequestDto["items"];
}

export type OrderSummaryDto = OrderSummary;
