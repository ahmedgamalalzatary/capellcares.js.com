import type { Collection, EntityMedia } from "@capella/shared";
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
  return toCollectionBase(collection, originalTotal);
}
