import type { Offer } from "@minikoshk/shared";
import { toOfferBase } from "../../offers/offer-mapper.shared.js";

type OfferRow = {
  id: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription: string | null;
  enDescription: string | null;
  imagePath: string | null;
  fixedPrice: unknown;
  stock: number;
  status: "active" | "inactive";
  items: Array<{ variantId: number; qty: number }>;
};

export function toStorefrontOffer(
  offer: OfferRow,
  originalTotal: number
): Omit<Offer, "createdAt" | "updatedAt" | "deletedAt"> {
  return toOfferBase(offer, originalTotal);
}
