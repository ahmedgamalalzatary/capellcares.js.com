import { asc, eq, sql } from "drizzle-orm";
import {
  announcementBarSettings,
  announcementItems
} from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";
import type { AnnouncementBarDto, AnnouncementItemDto } from "@minikoshk/shared";

function toDto(row: typeof announcementItems.$inferSelect): AnnouncementItemDto {
  return {
    id: row.id,
    text: { ar: row.arText, en: row.enText },
    isActive: row.isActive,
    sortOrder: row.sortOrder
  };
}

type AnnouncementReader = Pick<typeof db, "select">;

async function getAnnouncementBarFrom(
  reader: AnnouncementReader,
  includeInactive: boolean
): Promise<AnnouncementBarDto> {
  const settings = await reader.select({ enabled: announcementBarSettings.isEnabled })
    .from(announcementBarSettings)
    .where(eq(announcementBarSettings.id, 1))
    .limit(1);
  const rows = await reader.select()
    .from(announcementItems)
    .where(includeInactive ? undefined : eq(announcementItems.isActive, true))
    .orderBy(asc(announcementItems.sortOrder), asc(announcementItems.id));

  return {
    enabled: settings[0]?.enabled ?? false,
    items: rows.map(toDto)
  };
}

export async function getAnnouncementBar(includeInactive: boolean): Promise<AnnouncementBarDto> {
  return getAnnouncementBarFrom(db, includeInactive);
}

export async function setAnnouncementBarEnabled(enabled: boolean): Promise<AnnouncementBarDto> {
  return db.transaction(async (tx) => {
    await tx.insert(announcementBarSettings)
      .values({ id: 1, isEnabled: enabled })
      .onDuplicateKeyUpdate({ set: { isEnabled: enabled } });
    return getAnnouncementBarFrom(tx, true);
  });
}

export async function createAnnouncementItem(
  text: { ar: string; en: string }
): Promise<{ item: AnnouncementItemDto; announcementBar: AnnouncementBarDto }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT ${announcementBarSettings.id} FROM ${announcementBarSettings} WHERE ${announcementBarSettings.id} = 1 FOR UPDATE`);
    const [{ nextSortOrder }] = await tx.select({
      nextSortOrder: sql<number>`coalesce(max(${announcementItems.sortOrder}), -1) + 1`
    }).from(announcementItems);
    const [created] = await tx.insert(announcementItems).values({
      arText: text.ar,
      enText: text.en,
      sortOrder: Number(nextSortOrder)
    }).$returningId();
    const [row] = await tx.select().from(announcementItems).where(eq(announcementItems.id, created.id)).limit(1);
    return {
      item: toDto(row),
      announcementBar: await getAnnouncementBarFrom(tx, true)
    };
  });
}

export async function updateAnnouncementItem(
  id: number,
  input: { text?: { ar: string; en: string }; isActive?: boolean }
): Promise<{ item: AnnouncementItemDto; announcementBar: AnnouncementBarDto } | null> {
  return db.transaction(async (tx) => {
    const updates: Partial<typeof announcementItems.$inferInsert> = {};
    if (input.text) {
      updates.arText = input.text.ar;
      updates.enText = input.text.en;
    }
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    await tx.update(announcementItems).set(updates).where(eq(announcementItems.id, id));
    const [updated] = await tx.select().from(announcementItems).where(eq(announcementItems.id, id)).limit(1);
    if (!updated) return null;
    return {
      item: toDto(updated),
      announcementBar: await getAnnouncementBarFrom(tx, true)
    };
  });
}

export async function deleteAnnouncementItem(id: number): Promise<AnnouncementBarDto | null> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: announcementItems.id })
      .from(announcementItems)
      .where(eq(announcementItems.id, id))
      .limit(1);
    if (!existing) return null;
    await tx.delete(announcementItems).where(eq(announcementItems.id, id));
    return getAnnouncementBarFrom(tx, true);
  });
}

export async function reorderAnnouncementItems(ids: number[]): Promise<AnnouncementBarDto | null> {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: announcementItems.id }).from(announcementItems);
    if (
      ids.length !== existing.length ||
      new Set(ids).size !== ids.length ||
      existing.some((row) => !ids.includes(row.id))
    ) {
      return null;
    }

    for (const [sortOrder, id] of ids.entries()) {
      await tx.update(announcementItems).set({ sortOrder }).where(eq(announcementItems.id, id));
    }
    return getAnnouncementBarFrom(tx, true);
  });
}
