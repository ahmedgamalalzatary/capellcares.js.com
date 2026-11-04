import type { z } from "zod";
import type { checkoutResponseSchema } from "../schemas/checkout.schema.js";

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
  areaId: number;
  addressLine: string;
  buildingApartment: string;
  notes?: string;
  paymentMethod: "cod";
  expectedAmountFils?: number;
  customerId?: number | null;
  items: CheckoutItemDto[];
}

export interface CheckoutQuoteRequestDto {
  areaId: number;
  items: CheckoutItemDto[];
}

export interface CheckoutQuoteDto {
  subtotal: number;
  deliveryFee: number;
  total: number;
}
