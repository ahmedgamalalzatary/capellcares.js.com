import type { Order, OrderItem, OrderSummary } from "../types/index.js";
import type { CheckoutRequestDto } from "./checkout.dto.js";
import type { ShippingAddress } from "../schemas/shipping.schema.js";

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
  relatedShipments?: AdminRelatedShipmentDto[];
  workItem?: AdminShipmentListItemDto["workItem"];
  flags?: Pick<AdminOrderReviewFlagDto, "id" | "flagType" | "reason">[];
  destination?: ShippingAddress;
  editEnabled?: boolean;
  /** Which shipment edit fields are actually supported for this shipment. `recipientPhone`/`address` are documented; `recipientName`/`notes`/`size` appear only with verified merchant evidence. Absent means the capability is unknown (e.g. bulk), so the server remains the enforcement point. */
  editFields?: Array<"recipientPhone" | "address" | "recipientName" | "notes" | "size">;
  hasPendingEdit?: boolean;
  packingSize?: "small" | "medium" | "large" | null;
  carrierSnapshot?: Record<string, unknown> | null;
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

/** Already-linked carrier parcels; operational actions remain on the outgoing order. */
export interface AdminRelatedShipmentDto {
  id: number;
  kind: "return" | "exchange";
  trackingNumber: string;
  manualState: ManualShippingState | null;
  carrierState: Exclude<AdminOrderShippingStateDto["carrierState"], null>;
  rawProviderState: string;
  rawProviderCode: number | null;
  rawProviderType: string | null;
  custodyState: AdminOrderShippingStateDto["custodyState"];
  providerEventAtMs: number | null;
  workItem: AdminShipmentListItemDto["workItem"];
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
  workItem: { operation: "create_delivery" | "cancel_delivery" | "terminate_delivery" | "sync_delivery" | "edit_delivery";
    status: "pending" | "processing" | "succeeded" | "failed" | "review_required"; lastError: string | null } | null;
}

export interface CreateOrderDto {
  checkout: CheckoutRequestDto["items"];
}

export type OrderSummaryDto = OrderSummary;
