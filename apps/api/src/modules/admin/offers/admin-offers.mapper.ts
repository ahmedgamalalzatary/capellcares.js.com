import type { Offer } from "@capella/shared";

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
  return {
    id: offer.id,
    slug: offer.slug,
    name: {
      ar: offer.arName,
      en: offer.enName
    },
    description: {
      ar: offer.arDescription ?? "",
      en: offer.enDescription ?? ""
    },
    imagePath: offer.imagePath ?? "",
    price: Number(offer.fixedPrice),
    originalTotal,
    stock,
    items: offer.items.map((item) => ({
      variantId: item.variantId,
      qty: item.qty
    })),
    status: offer.status,
    createdAt: new Date(offer.createdAt).toISOString(),
    updatedAt: new Date(offer.updatedAt).toISOString(),
    deletedAt: offer.deletedAt ? new Date(offer.deletedAt).toISOString() : null
  };
}
