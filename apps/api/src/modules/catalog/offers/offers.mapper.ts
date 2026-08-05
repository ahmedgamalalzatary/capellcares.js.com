import type { Offer } from "@capella/shared";
import { toOfferBase } from "../../offers/offer-mapper.shared.js";

type OfferRow = {
  id: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription: string | null;
  enDescription: string | null;
  imagePath: string | null;
  media?: Array<{ type: "image" | "video"; url: string }>;
  fixedPrice: unknown;
  categoryId: number | null;
  stock: number;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  items: Array<{ variantId: number; qty: number }>;
};

export function toStorefrontOffer(
  offer: OfferRow,
  originalTotal: number
): Omit<Offer, "createdAt" | "updatedAt" | "deletedAt"> {
  return toOfferBase(offer, originalTotal);
}
