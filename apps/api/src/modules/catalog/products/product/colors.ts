import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { entityMedia, productColors, productVariants } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import type { ProductColor } from "@capella/shared";
import {
  normalizeEntityMedia,
  parseEntityMediaInput,
  type EntityMediaItem
} from "../../../shared/entity-media/entity-media.repository.js";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** One colour as the ERP sends it: a positive id keeps a stored colour, a negative one is new and is what its variants point at until saved. */
export type ProductColorInput = {
  id: number;
  arName: string;
  enName: string;
  hex: string | null;
  media: EntityMediaItem[];
};

const HEX = /^#[0-9a-f]{6}$/;

/** A missing key means "leave the colours as stored". Returns "invalid" when a colour is malformed or has neither a picked colour nor a name. */
export function parseProductColorsInput(value: unknown): ProductColorInput[] | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return "invalid";
  const parsed: ProductColorInput[] = [];
  for (const item of value as any[]) {
    const id = Number(item?.id);
    if (!Number.isInteger(id) || id === 0) return "invalid";
    const arName = String(item?.name?.ar ?? item?.arName ?? "").trim();
    const enName = String(item?.name?.en ?? item?.enName ?? "").trim();
    const rawHex = item?.hex == null ? "" : String(item.hex).trim().toLowerCase();
    if (rawHex && !HEX.test(rawHex)) return "invalid";
    if (!rawHex && !arName && !enName) return "invalid";
    if (arName.length > 255 || enName.length > 255) return "invalid";
    parsed.push({ id, arName, enName, hex: rawHex || null, media: parseEntityMediaInput(item?.media) ?? [] });
  }
  if (new Set(parsed.map((color) => color.id)).size !== parsed.length) return "invalid";
  return parsed;
}

export async function loadActiveProductColorIds(productId: number, executor?: DbTransaction) {
  const rows = await (executor ?? db)
    .select({ id: productColors.id })
    .from(productColors)
    .where(and(eq(productColors.productId, productId), isNull(productColors.deletedAt)));
  return rows.map((row) => row.id);
}

/** The live colours of each product, in order, each with its own gallery. */
export async function loadProductColors(productIds: number[]): Promise<Map<number, ProductColor[]>> {
  const byProduct = new Map<number, ProductColor[]>();
  if (productIds.length === 0) return byProduct;

  const colors = await db
    .select()
    .from(productColors)
    .where(and(inArray(productColors.productId, productIds), isNull(productColors.deletedAt)))
    .orderBy(asc(productColors.sortOrder), asc(productColors.id));
  if (colors.length === 0) return byProduct;

  const mediaRows = await db
    .select({
      colorId: entityMedia.productColorId,
      mediaType: entityMedia.mediaType,
      url: entityMedia.url,
      arUrl: entityMedia.arUrl,
      sortOrder: entityMedia.sortOrder
    })
    .from(entityMedia)
    .where(inArray(entityMedia.productColorId, colors.map((color) => color.id)))
    .orderBy(asc(entityMedia.sortOrder), asc(entityMedia.id));
  const mediaByColor = new Map<number, typeof mediaRows>();
  for (const row of mediaRows) {
    if (row.colorId == null) continue;
    mediaByColor.set(row.colorId, [...(mediaByColor.get(row.colorId) ?? []), row]);
  }

  for (const color of colors) {
    const list = byProduct.get(color.productId) ?? [];
    list.push({
      id: color.id,
      name: { ar: color.arName, en: color.enName },
      hex: color.hex,
      media: normalizeEntityMedia(mediaByColor.get(color.id), null),
      sortOrder: color.sortOrder
    });
    byProduct.set(color.productId, list);
  }
  return byProduct;
}

/**
 * Saves the given colours and their galleries. Returns how the request's colour ids map to stored ids, and which stored colours were left
 * out; call `removeProductColorsRepo` with those once the variants no longer point at them.
 */
export async function saveProductColorsRepo(productId: number, colors: ProductColorInput[], tx: DbTransaction) {
  const existingIds = await loadActiveProductColorIds(productId, tx);
  const idMap = new Map<number, number>();

  for (let index = 0; index < colors.length; index += 1) {
    const color = colors[index]!;
    const values = { arName: color.arName, enName: color.enName, hex: color.hex, sortOrder: index + 1 };
    let colorId: number;
    if (color.id > 0 && existingIds.includes(color.id)) {
      colorId = color.id;
      await tx.update(productColors).set(values).where(eq(productColors.id, colorId));
    } else {
      const [created] = await tx.insert(productColors).values({ productId, ...values }).$returningId();
      colorId = created.id;
    }
    idMap.set(color.id, colorId);

    await tx.delete(entityMedia).where(eq(entityMedia.productColorId, colorId));
    if (color.media.length > 0) {
      await tx.insert(entityMedia).values(color.media.map((item, mediaIndex) => ({
        productId,
        productColorId: colorId,
        mediaType: item.type,
        url: item.type === "video" ? item.url : item.enUrl,
        arUrl: item.type === "image" ? item.arUrl : null,
        sortOrder: mediaIndex + 1
      })));
    }
  }

  const kept = new Set(idMap.values());
  return { idMap, removedIds: existingIds.filter((id) => !kept.has(id)) };
}

/** Drops colours no live variant uses any more. One still named by a sold (soft-deleted) variant is soft-deleted so order history keeps it. */
export async function removeProductColorsRepo(colorIds: number[], tx: DbTransaction) {
  if (colorIds.length === 0) return;
  await tx.delete(entityMedia).where(inArray(entityMedia.productColorId, colorIds));
  const stillReferenced = await tx
    .select({ colorId: productVariants.colorId })
    .from(productVariants)
    .where(inArray(productVariants.colorId, colorIds));
  const referenced = new Set(stillReferenced.map((row) => row.colorId));
  const softIds = colorIds.filter((id) => referenced.has(id));
  const hardIds = colorIds.filter((id) => !referenced.has(id));
  if (softIds.length > 0) {
    await tx.update(productColors).set({ deletedAt: new Date() }).where(inArray(productColors.id, softIds));
  }
  if (hardIds.length > 0) {
    await tx.delete(productColors).where(inArray(productColors.id, hardIds));
  }
}
