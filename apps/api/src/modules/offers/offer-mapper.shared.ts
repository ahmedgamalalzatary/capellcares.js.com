import type { Offer } from "@capella/shared";

type OfferMapperRow = {
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

export function toOfferBase(
  offer: OfferMapperRow,
  originalTotal: number
): Omit<Offer, "createdAt" | "updatedAt" | "deletedAt"> {
  const price = Number(offer.fixedPrice);
  if (!Number.isFinite(price)) {
    throw new Error(
      `Invalid fixedPrice for offer id=${offer.id} slug=${offer.slug}: ${String(offer.fixedPrice)}`
    );
  }
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
    price,
    originalTotal,
    stock: offer.stock,
    items: offer.items.map((item) => ({
      variantId: item.variantId,
      qty: item.qty
    })),
    status: offer.status
  };
}
