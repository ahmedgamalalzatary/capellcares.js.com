import { and, eq, inArray, isNull } from "drizzle-orm";
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

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ProductAttributeInput = {
  brandId?: number | null;
  supplierId?: number | null;
  ageGroupIds?: number[];
  characterIds?: number[];
};

function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function parseOptionalId(value: unknown): number | null | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const id = Number(value);
  return isPositiveInt(id) ? id : "invalid";
}

function parseOptionalIds(value: unknown): number[] | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return "invalid";
  const ids = value.map(Number);
  return ids.every(isPositiveInt) ? [...new Set(ids)] : "invalid";
}

/** A missing key means "leave as stored", so callers that do not send attributes never clear them. Returns null when a value is malformed. */
export function parseProductAttributeInput(incoming: Record<string, unknown>): ProductAttributeInput | null {
  const brandId = parseOptionalId(incoming.brandId);
  const supplierId = parseOptionalId(incoming.supplierId);
  const ageGroupIds = parseOptionalIds(incoming.ageGroupIds);
  const characterIds = parseOptionalIds(incoming.characterIds);
  if (brandId === "invalid" || supplierId === "invalid" || ageGroupIds === "invalid" || characterIds === "invalid") {
    return null;
  }
  return { brandId, supplierId, ageGroupIds, characterIds };
}

async function allExist(table: typeof brands | typeof suppliers | typeof ageGroups | typeof characters, ids: number[]) {
  if (ids.length === 0) return true;
  const rows = await db.select({ id: table.id }).from(table).where(inArray(table.id, ids));
  return rows.length === ids.length;
}

export async function productAttributesExist(input: ProductAttributeInput) {
  const checks = await Promise.all([
    allExist(brands, input.brandId ? [input.brandId] : []),
    allExist(suppliers, input.supplierId ? [input.supplierId] : []),
    allExist(ageGroups, input.ageGroupIds ?? []),
    allExist(characters, input.characterIds ?? [])
  ]);
  return checks.every(Boolean);
}

export async function loadProductAttributeLinks(productIds: number[]) {
  const ageGroupIdsByProduct = new Map<number, number[]>();
  const characterIdsByProduct = new Map<number, number[]>();
  if (productIds.length === 0) return { ageGroupIdsByProduct, characterIdsByProduct };

  const [ageRows, characterRows] = await Promise.all([
    db.select().from(productAgeGroups).where(inArray(productAgeGroups.productId, productIds)),
    db.select().from(productCharacters).where(inArray(productCharacters.productId, productIds))
  ]);
  for (const row of ageRows) {
    ageGroupIdsByProduct.set(row.productId, [...(ageGroupIdsByProduct.get(row.productId) ?? []), row.ageGroupId]);
  }
  for (const row of characterRows) {
    characterIdsByProduct.set(row.productId, [...(characterIdsByProduct.get(row.productId) ?? []), row.characterId]);
  }
  return { ageGroupIdsByProduct, characterIdsByProduct };
}

export async function replaceProductAttributeLinks(
  productId: number,
  input: Pick<ProductAttributeInput, "ageGroupIds" | "characterIds">,
  tx: DbTransaction
) {
  if (input.ageGroupIds) {
    await tx.delete(productAgeGroups).where(eq(productAgeGroups.productId, productId));
    if (input.ageGroupIds.length > 0) {
      await tx.insert(productAgeGroups).values(input.ageGroupIds.map((ageGroupId) => ({ productId, ageGroupId })));
    }
  }
  if (input.characterIds) {
    await tx.delete(productCharacters).where(eq(productCharacters.productId, productId));
    if (input.characterIds.length > 0) {
      await tx.insert(productCharacters).values(input.characterIds.map((characterId) => ({ productId, characterId })));
    }
  }
}

const visibleProduct = and(eq(products.status, "active"), isNull(products.deletedAt));

export async function listVisibleBrandIdsRepo() {
  const rows = await db.selectDistinct({ id: products.brandId }).from(products).where(visibleProduct);
  return new Set(rows.map((row) => row.id));
}

export async function listVisibleAgeGroupIdsRepo() {
  const rows = await db
    .selectDistinct({ id: productAgeGroups.ageGroupId })
    .from(productAgeGroups)
    .innerJoin(products, eq(products.id, productAgeGroups.productId))
    .where(visibleProduct);
  return new Set<number | null>(rows.map((row) => row.id));
}

export async function listVisibleCharacterIdsRepo() {
  const rows = await db
    .selectDistinct({ id: productCharacters.characterId })
    .from(productCharacters)
    .innerJoin(products, eq(products.id, productCharacters.productId))
    .where(visibleProduct);
  return new Set<number | null>(rows.map((row) => row.id));
}
