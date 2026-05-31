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
  paymentMethod: "cod";
  customerId?: number | null;
  items: CheckoutItemDto[];
}
