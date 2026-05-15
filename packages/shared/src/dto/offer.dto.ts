export interface OfferItemDto {
  id: number;
  offerId: number;
  variantId: number;
  qty: number;
}

export interface OfferDto {
  id: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription: string | null;
  enDescription: string | null;
  imagePath: string | null;
  fixedPrice: number;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  deletedAt: string | null;
  items: OfferItemDto[];
}
