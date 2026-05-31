import type { Collection } from "@capella/shared";
import { toCollectionBase } from "../../collections/collection-mapper.shared.js";

type AdminCollectionRow = {
  id: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription: string | null;
  enDescription: string | null;
  imagePath: string | null;
  fixedPrice: unknown;
  categoryId: number;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  deletedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  items: Array<{ id?: number; variantId: number; qty: number }>;
};

export function toAdminCollection(
  collection: AdminCollectionRow,
  originalTotal: number,
  stock: number
): Collection {
  return {
    ...toCollectionBase({ ...collection, stock }, originalTotal),
    createdAt: new Date(collection.createdAt).toISOString(),
    updatedAt: new Date(collection.updatedAt).toISOString(),
    deletedAt: collection.deletedAt ? new Date(collection.deletedAt).toISOString() : null
  };
}
