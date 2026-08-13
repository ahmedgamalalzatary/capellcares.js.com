import type { EntityMedia, Offer } from "@capella/shared";

type OfferMapperRow = {
  id: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription: string | null;
  enDescription: string | null;
  youtubeUrl: string | null;
  imagePath: string | null;
  media?: EntityMedia[];
  fixedPrice: unknown;
  categoryId: number | null;
  stock: number;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  items: Array<{ id?: number; variantId: number; qty: number }>;
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
    youtubeUrl: offer.youtubeUrl ?? undefined,
    imagePath: offer.imagePath ?? "",
    media: offer.media ?? (offer.imagePath
      ? [{ type: "image", arUrl: null, enUrl: offer.imagePath }]
      : []),
    price,
    originalTotal,
    categoryId: offer.categoryId,
    stock: offer.stock,
    items: offer.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      qty: item.qty
    })),
    status: offer.status,
    visibility: offer.visibility
  };
}
