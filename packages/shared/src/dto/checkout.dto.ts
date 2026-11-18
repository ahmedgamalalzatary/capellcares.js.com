import type { z } from "zod";
import type { checkoutResponseSchema } from "../schemas/checkout.schema.js";
import type { ShippingAddress } from "../schemas/shipping.schema.js";

export type CheckoutResponseDto = z.infer<typeof checkoutResponseSchema>;

export interface CheckoutProductItemDto {
  type: "product";
  variantId: number;
  qty: number;
}

export interface CheckoutOfferItemDto {
  type: "offer";
  offerId: number;
  qty: number;
}

export interface CheckoutCollectionItemDto {
  type: "collection";
  collectionId: number;
  qty: number;
}

export type CheckoutItemDto = CheckoutProductItemDto | CheckoutOfferItemDto | CheckoutCollectionItemDto;

export interface CheckoutRequestDto {
  fullName: string;
  phone: string;
  email: string;
  governorate: string;
  cityArea: string;
  addressLine: string;
  buildingApartment: string;
  notes?: string;
  paymentMethod: "cod" | "paymob";
  expectedAmountCents?: number;
  shippingAddress?: ShippingAddress;
  shippingQuoteId?: string;
  customerId?: number | null;
  /** Promo code as typed by the customer; matched without case. */
  promoCode?: string;
  items: CheckoutItemDto[];
}

/** Why a promo code cannot be used right now (docs/promo-codes-spec.md section 9.4). */
export type PromoRejectionReason =
  | "login_required" | "not_found" | "inactive" | "private" | "first_order" | "usage_limit" | "customer_limit" | "in_use"
  | "below_min" | "above_max" | "min_pieces" | "no_effect" | "free_shipping_unavailable" | "gift_unavailable" | "online_payment_unavailable";

export type PromoRejectionDto = {
  status: "rejected";
  code: string;
  reason: PromoRejectionReason;
  /** below_min: EGP still missing; above_max: the code's maximum order amount; min_pieces: eligible pieces still missing. */
  missingAmount?: number;
  maxAmount?: number;
  missingPieces?: number;
};

export type PromoAppliedDto = {
  status: "applied";
  code: string;
  arName: string;
  enName: string;
  discount: number;
  /** Sale savings the customer gives up on the pieces the code now discounts instead. */
  saleGivenUp: number;
  freeShipping: boolean;
  /** Lines whose sale the code replaced: the customer confirms these new prices before applying the code. */
  replacedSales: Array<{ index: number; nameAr: string; nameEn: string; previousLineTotal: number; lineTotal: number }>;
};

/** The cart as the server prices it: every line, the products total and the promo code outcome. */
export type CheckoutPriceResponseDto = {
  items: Array<{ index: number; unitPrice: number; originalUnitPrice: number; lineTotal: number; promoDiscount: number }>;
  productsTotal: number;
  promo: PromoAppliedDto | PromoRejectionDto | null;
};
