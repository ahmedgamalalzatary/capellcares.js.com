import type { NextFunction, Request, Response } from "express";
import { and, asc, eq, inArray, max, ne, or } from "drizzle-orm";
import {
  ageGroups,
  brands,
  characters,
  productAgeGroups,
  productCharacters,
  products,
  suppliers
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { resolveEntitySlug } from "../../../services/slug.service.js";
import {
  listVisibleAgeGroupIdsRepo,
  listVisibleBrandIdsRepo,
  listVisibleCharacterIdsRepo
} from "../../catalog/products/product/attributes.js";
import { isDuplicateEntryError } from "../shared/db-errors.js";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";

async function safeRevalidate() {
  try {
    await triggerStorefrontRevalidation({ entity: "product-attributes" });
  } catch (error) {
    console.warn("Failed to trigger storefront revalidation for product attributes", error);
  }
}

function positiveId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Brands, characters and age groups share one shape; only brands and characters carry an image. The three tables have identical column names, so one typed reference serves them all. */
function namedAttributeHandlers(config: {
  table: typeof brands | typeof characters | typeof ageGroups;
  hasImage: boolean;
  isInUse: (id: number) => Promise<boolean>;
  visibleIds: () => Promise<Set<number | null>>;
}) {
  const table = config.table as typeof brands;

  const listRows = () => db.select().from(table).orderBy(asc(table.sortOrder), asc(table.id));
  const toItem = (row: typeof brands.$inferSelect) => ({
    id: row.id,
    slug: row.slug,
    name: { ar: row.arName, en: row.enName },
    sortOrder: row.sortOrder,
    ...(config.hasImage ? { imagePath: row.imagePath ?? null } : {})
  });

  const adminList = async (_req: Request, res: Response) => {
    res.json({ items: (await listRows()).map(toItem) });
  };

  const storefrontList = async (_req: Request, res: Response) => {
    const [rows, visible] = await Promise.all([listRows(), config.visibleIds()]);
    res.json({ items: rows.map((row) => ({ ...toItem(row), hasProducts: visible.has(row.id) })) });
  };

  const upsert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const incoming = req.body ?? {};
      const arName = String(incoming.name?.ar ?? "").trim();
      const enName = String(incoming.name?.en ?? "").trim();
      if (!arName || !enName) return res.status(400).json({ ok: false, reason: "name-required" });

      const id = incoming.id == null ? null : positiveId(incoming.id);
      if (incoming.id != null && id == null) return res.status(400).json({ ok: false, reason: "invalid-id" });

      const newSlug = resolveEntitySlug(undefined, enName);
      const [clash] = await db
        .select({ id: table.id })
        .from(table)
        .where(and(or(eq(table.enName, enName), eq(table.slug, newSlug)), id ? ne(table.id, id) : undefined))
        .limit(1);
      if (clash) return res.status(409).json({ ok: false, reason: "name-conflict" });

      const imageValues = config.hasImage
        ? { imagePath: typeof incoming.imagePath === "string" && incoming.imagePath.trim() ? incoming.imagePath.trim() : null }
        : {};

      let savedId = id;
      if (id) {
        // The slug stays fixed on rename so shared links keep working.
        const [existing] = await db.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1);
        if (!existing) return res.status(404).json({ ok: false, reason: "not-found" });
        await db.update(table).set({ arName, enName, ...imageValues }).where(eq(table.id, id));
      } else {
        const [{ highest }] = await db.select({ highest: max(table.sortOrder) }).from(table);
        const [created] = await db
          .insert(table)
          .values({ slug: newSlug, arName, enName, sortOrder: (highest ?? 0) + 1, ...imageValues })
          .$returningId();
        savedId = created.id;
      }
      await safeRevalidate();
      return res.json({ ok: true, id: savedId });
    } catch (error) {
      if (isDuplicateEntryError(error)) return res.status(409).json({ ok: false, reason: "name-conflict" });
      return next(error);
    }
  };

  const reorder = async (req: Request, res: Response) => {
    const ids: unknown[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const parsed = ids.map(positiveId);
    if (parsed.length === 0 || parsed.some((id) => id == null)) {
      res.status(400).json({ ok: false, reason: "invalid-order" });
      return;
    }
    await db.transaction(async (tx) => {
      for (const [index, id] of parsed.entries()) {
        await tx.update(table).set({ sortOrder: index + 1 }).where(eq(table.id, id as number));
      }
    });
    await safeRevalidate();
    res.json({ ok: true });
  };

  const remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = positiveId(req.params.id);
      if (!id) return res.status(400).json({ ok: false, reason: "invalid-id" });
      if (await config.isInUse(id)) return res.status(409).json({ ok: false, reason: "in-use" });
      const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
      if (!row) return res.status(404).json({ ok: false, reason: "not-found" });
      await db.delete(table).where(eq(table.id, id));
      if (config.hasImage && row.imagePath) {
        const { deleteLocalUploadUrls } = await import("../../uploads/uploads.service.js");
        await deleteLocalUploadUrls([row.imagePath]);
      }
      await safeRevalidate();
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  };

  return { adminList, storefrontList, upsert, reorder, remove };
}

async function anyRow(query: Promise<unknown[]>) {
  return (await query).length > 0;
}

export const brandHandlers = namedAttributeHandlers({
  table: brands,
  hasImage: true,
  isInUse: (id) => anyRow(db.select({ id: products.id }).from(products).where(eq(products.brandId, id)).limit(1)),
  visibleIds: listVisibleBrandIdsRepo
});

export const characterHandlers = namedAttributeHandlers({
  table: characters,
  hasImage: true,
  isInUse: (id) => anyRow(db.select({ id: productCharacters.productId }).from(productCharacters).where(eq(productCharacters.characterId, id)).limit(1)),
  visibleIds: listVisibleCharacterIdsRepo
});

export const ageGroupHandlers = namedAttributeHandlers({
  table: ageGroups,
  hasImage: false,
  isInUse: (id) => anyRow(db.select({ id: productAgeGroups.productId }).from(productAgeGroups).where(eq(productAgeGroups.ageGroupId, id)).limit(1)),
  visibleIds: listVisibleAgeGroupIdsRepo
});

export const adminListSuppliers = async (_req: Request, res: Response) => {
  const rows = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(asc(suppliers.name));
  res.json({ items: rows });
};

export async function adminUpsertSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) return res.status(400).json({ ok: false, reason: "name-required" });
    const id = req.body?.id == null ? null : positiveId(req.body.id);
    if (req.body?.id != null && id == null) return res.status(400).json({ ok: false, reason: "invalid-id" });
    if (id) {
      await db.update(suppliers).set({ name }).where(eq(suppliers.id, id));
      return res.json({ ok: true, id });
    }
    const [created] = await db.insert(suppliers).values({ name }).$returningId();
    return res.json({ ok: true, id: created.id });
  } catch (error) {
    if (isDuplicateEntryError(error)) return res.status(409).json({ ok: false, reason: "name-conflict" });
    return next(error);
  }
}

export async function adminDeleteSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, reason: "invalid-id" });
    if (await anyRow(db.select({ id: products.id }).from(products).where(inArray(products.supplierId, [id])).limit(1))) {
      return res.status(409).json({ ok: false, reason: "in-use" });
    }
    await db.delete(suppliers).where(eq(suppliers.id, id));
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}
