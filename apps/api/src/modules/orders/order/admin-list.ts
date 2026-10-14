import { db } from "@capella/database/src/db";
import { orders } from "@capella/database/drizzle/schema";
import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { pageMeta, PAYMOB_REVERSED_STATUSES, type PaymentStatus } from "@capella/shared";
import { z } from "zod";
import { likeContains, pagedQuerySchema, pageWindow } from "../../../lib/pagination.js";
import { toNumber } from "./shared.js";

const SORT_COLUMNS = {
  code: orders.orderCode,
  customer: orders.fullName,
  email: orders.email,
  total: orders.totalAmount,
  payment: orders.paymentStatus,
  date: orders.createdAt
};

export const adminOrdersQuerySchema = pagedQuerySchema(Object.keys(SORT_COLUMNS) as Array<keyof typeof SORT_COLUMNS>, {
  payment: z.enum(["pending", "accepted", "denied"]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional()
});

export type AdminOrdersQuery = z.output<typeof adminOrdersQuerySchema>;

/** SQL twin of the shared `orderMatchesPaymentStatusFilter`: Paymob orders by the provider's status, others by the staff-set status. */
export function paymentStatusCondition(filter: PaymentStatus): SQL {
  const provider = orders.providerPaymentStatus;
  const reversed = [...PAYMOB_REVERSED_STATUSES];
  const paymob = filter === "accepted"
    ? eq(provider, "succeeded")
    : filter === "denied"
      ? inArray(provider, reversed)
      : or(isNull(provider), notInArray(provider, ["succeeded", ...reversed]));
  return or(
    and(ne(orders.paymentMethod, "paymob"), eq(orders.paymentStatus, filter)),
    and(eq(orders.paymentMethod, "paymob"), paymob)
  )!;
}

/** One page of the ERP orders list with its search, filters and sort applied in the database. */
export async function listAdminOrdersPageRepo(query: AdminOrdersQuery) {
  const conditions: SQL[] = [];
  if (query.q) {
    const pattern = likeContains(query.q);
    conditions.push(or(like(orders.orderCode, pattern), like(orders.fullName, pattern), like(orders.email, pattern), like(orders.phone, pattern))!);
  }
  if (query.payment) conditions.push(paymentStatusCondition(query.payment));
  if (query.from) conditions.push(gte(orders.createdAt, new Date(query.from)));
  if (query.to) conditions.push(lte(orders.createdAt, new Date(query.to)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const direction = query.dir === "desc" ? desc : asc;
  const orderBy = query.sort
    ? [direction(SORT_COLUMNS[query.sort]), desc(orders.createdAt), desc(orders.id)]
    : [desc(orders.createdAt), desc(orders.id)];
  const span = pageWindow(query);

  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(orders).where(where),
    db.select().from(orders).where(where).orderBy(...orderBy).limit(span.limit).offset(span.offset)
  ]);

  return {
    items: rows.map((row) => ({ ...row, totalAmount: toNumber(row.totalAmount) })),
    pagination: pageMeta(Number(total), query.page, query.pageSize)
  };
}

export const paymentSummaryQuerySchema = z.object({ since: z.string().datetime({ offset: true }).optional() }).strict();

/** Orders per payment outcome (the same rule as the list filter), for the dashboard. */
export async function adminOrderPaymentSummaryRepo(since?: string) {
  const countWhere = (status: PaymentStatus) => sql<string>`coalesce(sum(case when ${paymentStatusCondition(status)} then 1 else 0 end), 0)`;
  const [row] = await db.select({ accepted: countWhere("accepted"), pending: countWhere("pending"), denied: countWhere("denied") })
    .from(orders)
    .where(since ? gte(orders.createdAt, new Date(since)) : undefined);
  return { accepted: Number(row.accepted), pending: Number(row.pending), denied: Number(row.denied) };
}
