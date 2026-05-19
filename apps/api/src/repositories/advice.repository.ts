import { asc, desc, eq } from "drizzle-orm";
import { advices } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

export async function listAdvicesRepo(includeInactive = false) {
  return db
    .select()
    .from(advices)
    .where(includeInactive ? undefined : eq(advices.status, "active"))
    .orderBy(asc(advices.sortOrder), desc(advices.createdAt));
}

export async function upsertAdviceRepo(input: {
  id?: number;
  arTitle: string;
  enTitle: string;
  arDescription: string;
  enDescription: string;
  imagePath?: string | null;
  videoUrl?: string | null;
  status: "active" | "inactive";
  sortOrder: number;
}) {
  if (input.id) {
    const [existing] = await db.select({ id: advices.id }).from(advices).where(eq(advices.id, input.id)).limit(1);
    if (existing) {
      await db.update(advices).set(input).where(eq(advices.id, input.id));
      return { id: input.id };
    }
  }

  const [created] = await db.insert(advices).values(input).$returningId();
  return created;
}

export async function deleteAdviceRepo(id: number) {
  await db.delete(advices).where(eq(advices.id, id));
}

export async function toggleAdviceStatusRepo(id: number) {
  const [existing] = await db
    .select({ status: advices.status })
    .from(advices)
    .where(eq(advices.id, id))
    .limit(1);

  if (!existing) return;

  await db
    .update(advices)
    .set({ status: existing.status === "active" ? "inactive" : "active" })
    .where(eq(advices.id, id));
}
