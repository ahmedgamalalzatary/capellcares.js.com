// Promo code storage for the ERP. Codes are immutable once created (docs/promo-codes-spec.md section 3.8): this module only
// inserts codes and changes their status; there is deliberately no update or delete of rule columns.
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import {
  adminUsers,
  categories,
  collections,
  customers,
  offers,
  productVariants,
  products,
  promoCodeCustomers,
  promoCodeEvents,
  promoCodes,
  promoCodeTargets,
  promoRedemptions
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import type { PromoCodeCreateInput, PromoCodeStatus, PromoCodeStatusAction, PromoTargetInput } from "@capella/shared";
import { isDuplicateEntryError } from "../admin/shared/db-errors.js";

export class PromoCodeError extends Error {
  constructor(public readonly status: number, public readonly key: string) {
    super(key);
  }
}

const decimal = (value: number | null) => (value === null ? null : value.toFixed(3));
const number = (value: string | null) => (value === null ? null : Number(value));

type PromoUsage = { used: number; released: number };
const emptyUsage = (): PromoUsage => ({ used: 0, released: 0 });

async function loadUsage(ids: number[]): Promise<Map<number, PromoUsage>> {
  const usage = new Map<number, PromoUsage>(ids.map((id) => [id, emptyUsage()]));
  if (ids.length === 0) return usage;
  const rows = await db
    .select({ promoCodeId: promoRedemptions.promoCodeId, state: promoRedemptions.state, count: sql<number>`count(*)` })
    .from(promoRedemptions)
    .where(inArray(promoRedemptions.promoCodeId, ids))
    .groupBy(promoRedemptions.promoCodeId, promoRedemptions.state);
  for (const row of rows) usage.get(row.promoCodeId)![row.state] = Number(row.count);
  return usage;
}

function mapCode(row: typeof promoCodes.$inferSelect, usage: PromoUsage) {
  return {
    id: row.id,
    code: row.code,
    arName: row.arName,
    enName: row.enName,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    discountType: row.discountType,
    discountValue: number(row.discountValue),
    maxDiscountAmount: number(row.maxDiscountAmount),
    freeShipping: row.freeShipping,
    gift: row.giftItemType && row.giftItemId !== null ? { itemType: row.giftItemType, itemId: row.giftItemId, qty: row.giftQty ?? 1 } : null,
    eligibilityScope: row.eligibilityScope,
    minOrderAmount: number(row.minOrderAmount),
    maxOrderAmount: number(row.maxOrderAmount),
    minEligiblePieces: row.minEligiblePieces,
    maxDiscountedPieces: row.maxDiscountedPieces,
    totalUsageLimit: row.totalUsageLimit,
    perCustomerLimit: row.perCustomerLimit,
    firstOrderOnly: row.firstOrderOnly,
    isPrivate: row.isPrivate,
    showInAccount: row.showInAccount,
    createdAt: row.createdAt.toISOString(),
    usage
  };
}

export async function listPromoCodesRepo(filter: { status?: PromoCodeStatus }) {
  const rows = await db
    .select()
    .from(promoCodes)
    .where(filter.status ? eq(promoCodes.status, filter.status) : undefined)
    .orderBy(desc(promoCodes.createdAt), desc(promoCodes.id));
  const usage = await loadUsage(rows.map((row) => row.id));
  return rows.map((row) => mapCode(row, usage.get(row.id)!));
}

export async function getPromoCodeRepo(id: number) {
  const [row] = await db.select().from(promoCodes).where(eq(promoCodes.id, id)).limit(1);
  if (!row) return null;
  const [targets, codeCustomers, events, usage] = await Promise.all([
    db.select({ type: promoCodeTargets.targetType, id: promoCodeTargets.targetId, mode: promoCodeTargets.mode })
      .from(promoCodeTargets).where(eq(promoCodeTargets.promoCodeId, id)).orderBy(promoCodeTargets.id),
    db.select({ id: customers.id, name: customers.name, email: customers.email })
      .from(promoCodeCustomers).innerJoin(customers, eq(customers.id, promoCodeCustomers.customerId))
      .where(eq(promoCodeCustomers.promoCodeId, id)).orderBy(customers.name),
    db.select({ action: promoCodeEvents.action, createdAt: promoCodeEvents.createdAt, adminName: adminUsers.name })
      .from(promoCodeEvents).leftJoin(adminUsers, eq(adminUsers.id, promoCodeEvents.adminUserId))
      .where(eq(promoCodeEvents.promoCodeId, id)).orderBy(promoCodeEvents.createdAt, promoCodeEvents.id),
    loadUsage([id])
  ]);
  const pick = (mode: "include" | "exclude") => targets.filter((target) => target.mode === mode).map(({ type, id: targetId }) => ({ type, id: targetId }));
  return {
    ...mapCode(row, usage.get(id)!),
    eligibility: { scope: row.eligibilityScope, include: pick("include"), exclude: pick("exclude") },
    customers: codeCustomers,
    events: events.map((event) => ({ action: event.action, adminName: event.adminName, createdAt: event.createdAt.toISOString() }))
  };
}

const TARGET_TABLES = {
  category: { table: categories, id: categories.id },
  product: { table: products, id: products.id },
  variant: { table: productVariants, id: productVariants.id },
  offer: { table: offers, id: offers.id },
  collection: { table: collections, id: collections.id }
} as const;

async function allExist(type: keyof typeof TARGET_TABLES, ids: number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return true;
  const { table, id } = TARGET_TABLES[type];
  const rows = await db.select({ id }).from(table).where(inArray(id, unique));
  return rows.length === unique.length;
}

async function assertReferencesExist(input: PromoCodeCreateInput) {
  const targets: PromoTargetInput[] = [...input.eligibility.include, ...input.eligibility.exclude];
  for (const type of Object.keys(TARGET_TABLES) as Array<keyof typeof TARGET_TABLES>) {
    if (!(await allExist(type, targets.filter((target) => target.type === type).map((target) => target.id)))) {
      throw new PromoCodeError(400, "promo.target_missing");
    }
  }
  if (input.gift) {
    const giftType = input.gift.itemType === "product_variant" ? "variant" : input.gift.itemType;
    if (!(await allExist(giftType, [input.gift.itemId]))) throw new PromoCodeError(400, "promo.gift_missing");
  }
  if (input.customerIds.length > 0) {
    const unique = [...new Set(input.customerIds)];
    const found = await db.select({ id: customers.id }).from(customers).where(inArray(customers.id, unique));
    if (found.length !== unique.length) throw new PromoCodeError(400, "promo.customer_missing");
  }
}

export async function createPromoCodeRepo(input: PromoCodeCreateInput, adminUserId: number, now = new Date()) {
  const startsAt = input.startsAt ? new Date(input.startsAt) : now;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (endsAt && endsAt <= now) throw new PromoCodeError(400, "promo.schedule_ended");
  await assertReferencesExist(input);

  const [existing] = await db.select({ id: promoCodes.id }).from(promoCodes).where(eq(promoCodes.codeNormalized, input.code)).limit(1);
  if (existing) throw new PromoCodeError(409, "promo.code_taken");

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(promoCodes).values({
        code: input.code,
        codeNormalized: input.code,
        arName: input.arName,
        enName: input.enName,
        status: "active",
        startsAt,
        endsAt,
        discountType: input.discountType,
        discountValue: decimal(input.discountValue),
        maxDiscountAmount: decimal(input.maxDiscountAmount),
        freeShipping: input.freeShipping,
        giftItemType: input.gift?.itemType ?? null,
        giftItemId: input.gift?.itemId ?? null,
        giftQty: input.gift?.qty ?? null,
        eligibilityScope: input.eligibility.scope,
        minOrderAmount: decimal(input.minOrderAmount),
        maxOrderAmount: decimal(input.maxOrderAmount),
        minEligiblePieces: input.minEligiblePieces,
        maxDiscountedPieces: input.maxDiscountedPieces,
        totalUsageLimit: input.totalUsageLimit,
        perCustomerLimit: input.perCustomerLimit,
        firstOrderOnly: input.firstOrderOnly,
        isPrivate: input.isPrivate,
        showInAccount: false,
        createdByAdminId: adminUserId
      }).$returningId();
      const id = created!.id;
      const targetRows = [
        ...input.eligibility.include.map((target) => ({ ...target, mode: "include" as const })),
        ...input.eligibility.exclude.map((target) => ({ ...target, mode: "exclude" as const }))
      ];
      const uniqueTargets = [...new Map(targetRows.map((row) => [`${row.type}:${row.id}:${row.mode}`, row])).values()];
      if (uniqueTargets.length > 0) {
        await tx.insert(promoCodeTargets).values(uniqueTargets.map((row) => ({ promoCodeId: id, targetType: row.type, targetId: row.id, mode: row.mode })));
      }
      const customerIds = [...new Set(input.customerIds)];
      if (customerIds.length > 0) {
        await tx.insert(promoCodeCustomers).values(customerIds.map((customerId) => ({ promoCodeId: id, customerId })));
      }
      await tx.insert(promoCodeEvents).values({ promoCodeId: id, action: "created", adminUserId });
      return { id };
    });
  } catch (error) {
    if (isDuplicateEntryError(error)) throw new PromoCodeError(409, "promo.code_taken");
    throw error;
  }
}

const TRANSITIONS: Record<PromoCodeStatusAction, { from: PromoCodeStatus[]; to: PromoCodeStatus; event: "paused" | "resumed" | "stopped" }> = {
  pause: { from: ["active"], to: "paused", event: "paused" },
  resume: { from: ["paused"], to: "active", event: "resumed" },
  stop: { from: ["active", "paused"], to: "stopped", event: "stopped" }
};

export async function changePromoCodeStatusRepo(id: number, action: PromoCodeStatusAction, adminUserId: number) {
  const transition = TRANSITIONS[action];
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ status: promoCodes.status }).from(promoCodes).where(eq(promoCodes.id, id)).for("update");
    if (!row) throw new PromoCodeError(404, "promo.not_found");
    if (!transition.from.includes(row.status)) throw new PromoCodeError(409, "promo.status_transition_invalid");
    await tx.update(promoCodes).set({ status: transition.to }).where(eq(promoCodes.id, id));
    await tx.insert(promoCodeEvents).values({ promoCodeId: id, action: transition.event, adminUserId });
    return { id, status: transition.to };
  });
}

/** Customers for a private code's picker, matched by name or email. */
export async function searchPromoCustomersRepo(query: string) {
  const pattern = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  return db
    .select({ id: customers.id, name: customers.name, email: customers.email })
    .from(customers)
    .where(and(or(like(customers.name, pattern), like(customers.email, pattern))))
    .orderBy(customers.name)
    .limit(20);
}
