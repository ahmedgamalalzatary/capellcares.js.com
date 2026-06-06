import type {
  CheckoutRequestDto,
  Language as SharedLanguage,
  Order as SharedOrder,
  PaymentStatus as SharedPaymentStatus
} from "@capella/shared";

export type Language = SharedLanguage;
export type PaymentStatus = SharedPaymentStatus;

export type CheckoutPayload = CheckoutRequestDto;
export type Order = SharedOrder;
