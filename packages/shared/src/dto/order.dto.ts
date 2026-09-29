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

/** Staff alert for one unresolved order review flag. Acknowledging it never changes the order. */
export interface AdminOrderReviewFlagDto {
  id: number;
  orderId: number;
  orderCode: string;
  flagType: "address_review" | "expiry_review" | "refund_review" | "amount_mismatch" | "custody_review" | "cancellation_pending" | "untouched_paid";
  reason: string;
  status: "open" | "resolved";
  customerName: string;
  totalAmount: number;
  orderCreatedAt: string;
  flaggedAt: string;
}

type ManualShippingState = "preparing" | "ready_for_pickup" | "printed" | "delivered" | "returned";
export interface AdminOrderShippingStateDto {
  manualState: ManualShippingState | null;
  carrierState: "created" | "picked_up" | "in_transit" | "delivered" | "returned" | "cancelled" | "exception" | null;
  rawProviderCode: number | null;
  rawProviderType: string | null;
  custodyState: "unknown" | "carrier" | "recipient" | "warehouse_uninspected";
  collection: { confirmed: boolean; amountCents: number | null };
  cancellation?: { status: "pending" | "cancelled"; requestedAtMs: number | null; completedAtMs: number | null;
    stockRestoredAtMs: number | null; refundRequiredCents: number } | null;
  processing: { startedAtMs: number | null; pickupAtMs: number | null; addressBlockedAtMs: number | null; untouchedExpiryApplies: boolean };
  history: { id: number; state: ManualShippingState; actorType: "staff" | "system"; actorId: number | null; atMs: number; reason: string | null }[];
}

/** One ERP shipping-overview row: an outgoing shipping order, or a linked return/exchange shipment. */
export interface AdminShipmentListItemDto {
  orderId: number;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: "cod" | "paymob";
  paymentStatus: "pending" | "accepted" | "denied";
  providerPaymentStatus: "pending" | "succeeded" | "failed" | "partially_refunded" | "refunded" | "voided" | null;
  totalAmount: number;
  orderCreatedAt: string;
  shipmentId: number | null;
  kind: "outgoing" | "return" | "exchange";
  trackingNumber: string | null;
  carrierState: AdminOrderShippingStateDto["carrierState"];
  rawProviderState: string | null;
  manualState: AdminOrderShippingStateDto["manualState"];
  custodyState: AdminOrderShippingStateDto["custodyState"];
  size: "small" | "medium" | "large" | null;
  carrierSize: string | null;
  shippingAmountCents: number | null;
  collectedAmountCents: number | null;
  collectionConfirmed: boolean;
  cancellationStatus: "pending" | "cancelled" | null;
  openFlagTypes: AdminOrderReviewFlagDto["flagType"][];
  needsAttention: boolean;
  workItem: { operation: "create_delivery" | "cancel_delivery" | "terminate_delivery" | "sync_delivery";
    status: "pending" | "processing" | "succeeded" | "failed" | "review_required"; lastError: string | null } | null;
}

export interface CreateOrderDto {
  checkout: CheckoutRequestDto["items"];
}

export type OrderSummaryDto = OrderSummary;
