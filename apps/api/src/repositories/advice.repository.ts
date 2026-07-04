import { and, eq } from "drizzle-orm";
import { compareByScopedOrdering, type OrderingSurface } from "@capella/shared";
import { advices, entityOrderings } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import {
  assertCompleteOrderedIds,
  loadScopedRanksRepo,
  replaceScopedOrderingRepo
} from "./entity-ordering.repository.js";

async function withAdviceRanks<T extends { id: number }>(rows: T[], surface: OrderingSurface) {
  const rankByAdviceId = await loadScopedRanksRepo({
    scopeType: "root",
    scopeId: null,
    entityType: "advice",
    entityIds: rows.map((row) => row.id)
  });
  return rows
    .map((row) => ({ ...row, sortOrder: rankByAdviceId.get(row.id) }))
    .sort(compareByScopedOrdering.bind(null, surface));
}

export async function listAdvicesRepo(includeInactive = false, surface: OrderingSurface = "erp") {
  const rows = await db
    .select()
    .from(advices)
    .where(includeInactive ? undefined : eq(advices.status, "active"));
  return withAdviceRanks(rows, surface);
}

export async function reorderAdvicesRepo(input: { ids: number[] }) {
  const scopeRows = await db.select({ id: advices.id }).from(advices);
  assertCompleteOrderedIds({
    requestedIds: input.ids,
    scopeEntityIds: scopeRows.map((row) => row.id),
    errorCode: "INVALID_ADVICE_ORDER",
    errorMessage: "Advice order is invalid"
  });
  await replaceScopedOrderingRepo({
    scopeType: "root",
    scopeId: null,
    entityType: "advice",
    ids: input.ids
  });
}

export async function upsertAdviceRepo(input: {
  id?: number;
  arTitle: string;
  enTitle: string;
  arDescription: string;
  enDescription: string;
  videoUrl: string;
  status: "active" | "inactive";
}) {
  if (input.id) {
    const [existing] = await db.select({ id: advices.id }).from(advices).where(eq(advices.id, input.id)).limit(1);
    if (existing) {
      await db.update(advices).set(input).where(eq(advices.id, input.id));
      return { id: input.id };
    }
  }

  const { id: _id, ...insertPayload } = input;
  const [created] = await db.insert(advices).values(insertPayload).$returningId();
  return created;
}

export async function deleteAdviceRepo(id: number) {
  return db.transaction(async (tx) => {
    await tx
      .delete(entityOrderings)
      .where(
        and(eq(entityOrderings.entityType, "advice"), eq(entityOrderings.entityId, id))
      );
    const result = await tx.delete(advices).where(eq(advices.id, id));
    return Number(result[0]?.affectedRows ?? 0) > 0;
  });
}

export async function toggleAdviceStatusRepo(id: number) {
  const [existing] = await db
    .select({ status: advices.status })
    .from(advices)
    .where(eq(advices.id, id))
    .limit(1);

  if (!existing) return false;

  await db
    .update(advices)
    .set({ status: existing.status === "active" ? "inactive" : "active" })
    .where(eq(advices.id, id));

  return true;
}
