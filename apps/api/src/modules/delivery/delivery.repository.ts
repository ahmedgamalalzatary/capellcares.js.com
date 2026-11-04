import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { deliveryAreas, deliveryGovernorates } from "@capella/database/drizzle/schema";
import type { CheckoutDeliveryGovernorate, DeliveryGovernorate, DeliverySettingsPayload } from "@capella/shared";

/** The full setup for the ERP, in display order, inactive rows included. */
export async function listDeliverySettingsRepo(): Promise<DeliveryGovernorate[]> {
  const [governorates, areas] = await Promise.all([
    db.select().from(deliveryGovernorates).orderBy(asc(deliveryGovernorates.sortOrder), asc(deliveryGovernorates.id)),
    db.select().from(deliveryAreas).orderBy(asc(deliveryAreas.sortOrder), asc(deliveryAreas.id))
  ]);
  return governorates.map((governorate) => ({
    id: governorate.id,
    arName: governorate.arName,
    enName: governorate.enName,
    status: governorate.status,
    sortOrder: governorate.sortOrder,
    areas: areas
      .filter((area) => area.governorateId === governorate.id)
      .map((area) => ({
        id: area.id,
        arName: area.arName,
        enName: area.enName,
        fee: Number(area.fee),
        status: area.status,
        sortOrder: area.sortOrder
      }))
  }));
}

/** What checkout may offer: active governorates with at least one active area. Fees stay server-side; the quote prices them. */
export async function listCheckoutGovernoratesRepo(): Promise<CheckoutDeliveryGovernorate[]> {
  const settings = await listDeliverySettingsRepo();
  return settings
    .filter((governorate) => governorate.status === "active")
    .map((governorate) => ({
      id: governorate.id,
      arName: governorate.arName,
      enName: governorate.enName,
      areas: governorate.areas
        .filter((area) => area.status === "active")
        .map(({ id, arName, enName }) => ({ id, arName, enName }))
    }))
    .filter((governorate) => governorate.areas.length > 0);
}

export class UnknownDeliveryAreaError extends Error {
  constructor() {
    super("Choose an available delivery area");
  }
}

/** An area checkout can deliver to right now, with the Arabic names the order keeps. */
export async function findCheckoutAreaRepo(areaId: number) {
  const [row] = await db
    .select({
      id: deliveryAreas.id,
      fee: deliveryAreas.fee,
      arName: deliveryAreas.arName,
      governorateArName: deliveryGovernorates.arName
    })
    .from(deliveryAreas)
    .innerJoin(deliveryGovernorates, eq(deliveryGovernorates.id, deliveryAreas.governorateId))
    .where(and(eq(deliveryAreas.id, areaId), eq(deliveryAreas.status, "active"), eq(deliveryGovernorates.status, "active")))
    .limit(1);
  if (!row) throw new UnknownDeliveryAreaError();
  return { ...row, fee: Number(row.fee) };
}

/**
 * Saves the whole setup at once: rows with an id are updated, rows without one are created, and anything left out is deleted
 * (orders that used a deleted area keep their names and fee; only their area link is cleared).
 * An id that does not belong to the row's place (unknown, or an area moved to another governorate) is treated as new.
 */
export async function saveDeliverySettingsRepo(payload: DeliverySettingsPayload) {
  await db.transaction(async (tx) => {
    const existingGovernorates = new Set((await tx.select({ id: deliveryGovernorates.id }).from(deliveryGovernorates)).map((row) => row.id));
    const existingAreas = new Map((await tx.select({ id: deliveryAreas.id, governorateId: deliveryAreas.governorateId }).from(deliveryAreas))
      .map((row) => [row.id, row.governorateId]));

    const keptGovernorates = payload.governorates.map((g) => g.id).filter((id): id is number => id != null && existingGovernorates.has(id));
    // Delete first so a renamed row can take a name a removed row used, without tripping the unique keys.
    if (keptGovernorates.length > 0) await tx.delete(deliveryGovernorates).where(notInArray(deliveryGovernorates.id, keptGovernorates));
    else await tx.delete(deliveryGovernorates);

    const keptAreas = payload.governorates.flatMap((g) => g.areas.map((a) => (
      a.id != null && g.id != null && existingAreas.get(a.id) === g.id ? a.id : null
    ))).filter((id): id is number => id != null);
    const remainingAreas = [...existingAreas.keys()].filter((id) => !keptAreas.includes(id));
    if (remainingAreas.length > 0) await tx.delete(deliveryAreas).where(inArray(deliveryAreas.id, remainingAreas));

    // Park kept names on placeholders so swapping two names inside one save cannot collide with the unique keys.
    for (const id of keptGovernorates) {
      await tx.update(deliveryGovernorates).set({ arName: `#${id}`, enName: `#${id}` }).where(eq(deliveryGovernorates.id, id));
    }
    for (const id of keptAreas) {
      await tx.update(deliveryAreas).set({ arName: `#${id}`, enName: `#${id}` }).where(eq(deliveryAreas.id, id));
    }

    for (const [governorateIndex, governorate] of payload.governorates.entries()) {
      const values = { arName: governorate.arName, enName: governorate.enName, status: governorate.status, sortOrder: governorateIndex };
      let governorateId: number;
      if (governorate.id != null && existingGovernorates.has(governorate.id)) {
        governorateId = governorate.id;
        await tx.update(deliveryGovernorates).set(values).where(eq(deliveryGovernorates.id, governorateId));
      } else {
        [{ id: governorateId }] = await tx.insert(deliveryGovernorates).values(values).$returningId();
      }

      for (const [areaIndex, area] of governorate.areas.entries()) {
        const areaValues = {
          arName: area.arName,
          enName: area.enName,
          fee: area.fee.toFixed(3),
          status: area.status,
          sortOrder: areaIndex
        };
        if (area.id != null && keptAreas.includes(area.id)) {
          await tx.update(deliveryAreas).set(areaValues).where(eq(deliveryAreas.id, area.id));
        } else {
          await tx.insert(deliveryAreas).values({ ...areaValues, governorateId });
        }
      }
    }
  });
}
