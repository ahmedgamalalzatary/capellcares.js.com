import type { Offer } from "@minikoshk/shared";
import { toOfferBase } from "../../offers/offer-mapper.shared.js";

type AdminOfferRow = {
  id: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription: string | null;
  enDescription: string | null;
  imagePath: string | null;
  fixedPrice: unknown;
  status: "active" | "inactive";
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
  items: Array<{ variantId: number; qty: number }>;
};

export function toAdminOffer(
  offer: AdminOfferRow,
  originalTotal: number,
  stock: number
): Offer {
  const base = toOfferBase({ ...offer, stock }, originalTotal);

  return {
    ...base,
    createdAt: new Date(offer.createdAt).toISOString(),
    updatedAt: new Date(offer.updatedAt).toISOString(),
    deletedAt: offer.deletedAt ? new Date(offer.deletedAt).toISOString() : null
  };
}
