import { asc, eq } from "drizzle-orm";
import { announcementBarSettings, announcements } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

export type AnnouncementInput = {
  arText: string;
  enText: string;
  status: "active" | "inactive";
  sortOrder: number;
};

const BAR_SETTINGS_ID = 1;

function mapRow(row: typeof announcements.$inferSelect) {
  return {
    id: row.id,
    arText: row.arText,
    enText: row.enText,
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt ?? ""),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt ?? "")
  };
}

type AnnouncementExecutor = Pick<typeof db, "select" | "insert">;

async function ensureBarSettings(tx: AnnouncementExecutor = db) {
  const existing = await tx
    .select({ id: announcementBarSettings.id })
    .from(announcementBarSettings)
    .where(eq(announcementBarSettings.id, BAR_SETTINGS_ID))
    .limit(1);
  if (existing.length === 0) {
    await tx.insert(announcementBarSettings).values({ id: BAR_SETTINGS_ID, status: "active" });
  }
}

async function loadAnnouncementState(tx: AnnouncementExecutor) {
  await ensureBarSettings(tx);
  const [settings] = await tx
    .select({ status: announcementBarSettings.status })
    .from(announcementBarSettings)
    .where(eq(announcementBarSettings.id, BAR_SETTINGS_ID))
    .limit(1);
  const rows = await tx
    .select()
    .from(announcements)
    .orderBy(asc(announcements.sortOrder), asc(announcements.id));
  return {
    barStatus: settings?.status ?? "active" as const,
    items: rows.map(mapRow)
  };
}

export async function listAnnouncementStateRepo() {
  return db.transaction(async (tx) => loadAnnouncementState(tx));
}

export async function getAnnouncementBarStatusRepo(): Promise<"active" | "inactive"> {
  const state = await listAnnouncementStateRepo();
  return state.barStatus;
}

export async function listAnnouncementsRepo() {
  const state = await listAnnouncementStateRepo();
  return state.items;
}

export async function listActiveAnnouncementTextsRepo(locale: "ar" | "en") {
  const { barStatus, items } = await listAnnouncementStateRepo();
  if (barStatus === "inactive") {
    return [];
  }
  return items
    .filter((row) => row.status === "active")
    .map((row) => (locale === "en" ? row.enText : row.arText));
}

export async function replaceAnnouncementsRepo(
  items: AnnouncementInput[],
  barStatus: "active" | "inactive" = "active"
) {
  await db.transaction(async (tx) => {
    await ensureBarSettings(tx);
    await tx
      .update(announcementBarSettings)
      .set({ status: barStatus })
      .where(eq(announcementBarSettings.id, BAR_SETTINGS_ID));
    await tx.delete(announcements);
    if (items.length === 0) {
      return;
    }
    await tx.insert(announcements).values(
      items.map((item) => ({
        arText: item.arText,
        enText: item.enText,
        status: item.status,
        sortOrder: item.sortOrder
      }))
    );
  });
}
