import type { Collection } from "@capella/shared";

type CollectionMapperRow = {
  id: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription: string | null;
  enDescription: string | null;
  imagePath: string | null;
  fixedPrice: unknown;
  categoryId: number;
  stock: number;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  items: Array<{ id?: number; variantId: number; qty: number }>;
};

export function toCollectionBase(
  collection: CollectionMapperRow,
  originalTotal: number
): Omit<Collection, "createdAt" | "updatedAt" | "deletedAt"> {
  if (collection.fixedPrice == null || collection.fixedPrice === "") {
    throw new Error(
      `Invalid fixedPrice for collection id=${collection.id} slug=${collection.slug}: ${String(collection.fixedPrice)}`
    );
  }
  const price = Number(collection.fixedPrice);
  if (!Number.isFinite(price)) {
    throw new Error(
      `Invalid fixedPrice for collection id=${collection.id} slug=${collection.slug}: ${String(collection.fixedPrice)}`
    );
  }
  return {
    id: collection.id,
    slug: collection.slug,
    name: {
      ar: collection.arName,
      en: collection.enName
    },
    description: {
      ar: collection.arDescription ?? "",
      en: collection.enDescription ?? ""
    },
    imagePath: collection.imagePath ?? "",
    price,
    originalTotal,
    categoryId: collection.categoryId,
    stock: collection.stock,
    items: collection.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      qty: item.qty
    })),
    status: collection.status,
    visibility: collection.visibility
  };
}
