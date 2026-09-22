import { getEffectiveVariantPrice, type Collection, type EntityMedia } from "@capella/shared";
import { toCollectionBase } from "../../collections/collection-mapper.shared.js";

type CollectionRow = {
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
  discount?: Collection["discount"];
  categoryId: number;
  stock: number;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  items: Array<{ variantId: number; qty: number }>;
};

export function toStorefrontCollection(
  collection: CollectionRow,
  originalTotal: number
): Omit<Collection, "createdAt" | "updatedAt" | "deletedAt"> {
  const base = toCollectionBase(collection, originalTotal);
  return { ...base, price: getEffectiveVariantPrice({ price: base.price, discount: base.discount }) };
}
