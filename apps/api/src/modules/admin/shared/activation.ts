import { and, eq, isNull, or, ne } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { collections, entityMedia, offers, products, productVariants } from "@capella/database/drizzle/schema";

/** What the storefront needs before an item may go live; mirrors the ERP form requirements. */
type BaseFacts = { arName: string; enName: string; categoryId: number | null; hasImage: boolean };
export type ProductActivationFacts = BaseFacts & { keywordCount: number; variantCount: number };
export type BundleActivationFacts = BaseFacts & { price: number };
type MediaOwner = "product" | "offer" | "collection";

function hasBasics(facts: BaseFacts) {
  return Boolean(facts.arName.trim() && facts.enName.trim() && facts.categoryId && facts.hasImage);
}

export function canActivateProduct(facts: ProductActivationFacts) {
  return hasBasics(facts) && facts.keywordCount > 0 && facts.variantCount > 0;
}

export function canActivateBundle(facts: BundleActivationFacts) {
  return hasBasics(facts) && facts.price > 0;
}

const mediaOwnerColumn = {
  product: entityMedia.productId,
  offer: entityMedia.offerId,
  collection: entityMedia.collectionId
} as const;

export async function storedHasImage(owner: MediaOwner, id: number, imagePath: string | null) {
  if (imagePath) return true;
  const [image] = await db
    .select({ id: entityMedia.id })
    .from(entityMedia)
    .where(and(
      eq(mediaOwnerColumn[owner], id),
      eq(entityMedia.mediaType, "image"),
      or(ne(entityMedia.url, ""), ne(entityMedia.arUrl, ""))
    ))
    .limit(1);
  return Boolean(image);
}

/** Current status plus activation facts of a stored product, or null when it does not exist. */
export async function findProductActivationRepo(id: number) {
  const [row] = await db
    .select({
      status: products.status,
      arName: products.arName,
      enName: products.enName,
      keywords: products.keywords,
      categoryId: products.categoryId,
      imagePath: products.imagePath
    })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!row) return null;
  const variants = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(and(eq(productVariants.productId, id), isNull(productVariants.deletedAt)));
  return {
    status: row.status,
    facts: {
      arName: row.arName,
      enName: row.enName,
      categoryId: row.categoryId,
      hasImage: await storedHasImage("product", id, row.imagePath),
      keywordCount: row.keywords.split(",").filter((keyword) => keyword.trim()).length,
      variantCount: variants.length
    } satisfies ProductActivationFacts
  };
}

/** Current status plus activation facts of a stored offer or collection, or null when it does not exist. */
export async function findBundleActivationRepo(owner: "offer" | "collection", id: number) {
  const table = owner === "offer" ? offers : collections;
  const [row] = await db
    .select({
      status: table.status,
      arName: table.arName,
      enName: table.enName,
      categoryId: table.categoryId,
      fixedPrice: table.fixedPrice,
      imagePath: table.imagePath
    })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  if (!row) return null;
  return {
    status: row.status,
    facts: {
      arName: row.arName,
      enName: row.enName,
      categoryId: row.categoryId,
      hasImage: await storedHasImage(owner, id, row.imagePath),
      price: Number(row.fixedPrice)
    } satisfies BundleActivationFacts
  };
}

/** Whether a save payload leaves the item with an image: new media wins, then an explicit imagePath, else what is already stored. */
export async function incomingHasImage(
  owner: MediaOwner,
  incoming: { id?: unknown; imagePath?: unknown; media?: unknown },
  media: Array<{ type: string; arUrl?: string | null; enUrl?: string | null }> | undefined
) {
  if (Object.prototype.hasOwnProperty.call(incoming, "media")) {
    return Boolean(media?.some((item) => item.type === "image" && (item.arUrl || item.enUrl)));
  }
  if (Object.prototype.hasOwnProperty.call(incoming, "imagePath")) {
    return Boolean(incoming.imagePath);
  }
  return incoming.id ? storedHasImage(owner, Number(incoming.id), null) : false;
}
