import { and, avg, count, desc, eq, sql } from "drizzle-orm";
import {
  customers,
  orderItems,
  orders,
  productVariants,
  reviewSubmissions,
  reviews
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import type { ReviewEntityType, ReviewStatus } from "@capella/shared";

export class ReviewAlreadySubmittedError extends Error {}
export class ReviewPurchaseRequiredError extends Error {}
export class ReviewNotFoundError extends Error {}
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function matchingAcceptedPurchase(tx: DbTransaction, customerId: number, entityType: ReviewEntityType, entityId: number) {
  const base = tx
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId));

  if (entityType === "product") {
    return base
      .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .where(and(
        eq(orders.customerId, customerId),
        eq(orders.paymentStatus, "accepted"),
        eq(orderItems.itemType, "product_variant"),
        eq(productVariants.productId, entityId)
      ))
      .limit(1)
      .for("update");
  }

  return base
    .where(and(
      eq(orders.customerId, customerId),
      eq(orders.paymentStatus, "accepted"),
      eq(orderItems.itemType, entityType),
      entityType === "offer"
        ? eq(orderItems.offerId, entityId)
        : eq(orderItems.collectionId, entityId)
    ))
    .limit(1)
    .for("update");
}

function isDuplicateEntry(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "ER_DUP_ENTRY" || candidate?.cause?.code === "ER_DUP_ENTRY";
}

export async function createReviewRepo(input: {
  customerId: number;
  entityType: ReviewEntityType;
  entityId: number;
  rating: number;
  comment?: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const [purchase] = await matchingAcceptedPurchase(tx, input.customerId, input.entityType, input.entityId);
      if (!purchase) throw new ReviewPurchaseRequiredError();
      const [submission] = await tx.insert(reviewSubmissions).values({
        customerId: input.customerId,
        entityType: input.entityType,
        entityId: input.entityId
      }).$returningId();
      const [created] = await tx.insert(reviews).values({
        submissionId: submission.id,
        customerId: input.customerId,
        entityType: input.entityType,
        entityId: input.entityId,
        rating: input.rating,
        comment: input.comment?.trim() || null
      }).$returningId();
      const [review] = await tx.select().from(reviews).where(eq(reviews.id, created.id)).limit(1);
      return review!;
    });
  } catch (error) {
    if (isDuplicateEntry(error)) throw new ReviewAlreadySubmittedError();
    throw error;
  }
}

export async function listPublicReviewsRepo(entityType: ReviewEntityType, entityId: number) {
  const [items, [summary]] = await Promise.all([
    db.select({
      id: reviews.id,
      customerName: customers.name,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt
    })
      .from(reviews)
      .innerJoin(customers, eq(customers.id, reviews.customerId))
      .where(and(eq(reviews.entityType, entityType), eq(reviews.entityId, entityId), eq(reviews.status, "approved")))
      .orderBy(desc(reviews.createdAt), desc(reviews.id)),
    db.select({ averageRating: avg(reviews.rating), reviewCount: count(reviews.id) })
      .from(reviews)
      .where(and(eq(reviews.entityType, entityType), eq(reviews.entityId, entityId), eq(reviews.status, "approved")))
  ]);

  return {
    summary: {
      averageRating: summary.reviewCount === 0 ? null : Number(Number(summary.averageRating).toFixed(2)),
      reviewCount: summary.reviewCount
    },
    items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))
  };
}

export async function listAdminReviewsRepo() {
  const rows = await db.select({
    id: reviews.id,
    customerId: reviews.customerId,
    customerName: customers.name,
    customerEmail: customers.email,
    entityType: reviews.entityType,
    entityId: reviews.entityId,
    rating: reviews.rating,
    comment: reviews.comment,
    status: reviews.status,
    moderatedByAdminUserId: reviews.moderatedByAdminUserId,
    moderatedAt: reviews.moderatedAt,
    createdAt: reviews.createdAt,
    updatedAt: reviews.updatedAt,
    entityNameAr: sql<string | null>`coalesce(
      (select ar_name from products where products.id = ${reviews.entityId} and ${reviews.entityType} = 'product'),
      (select ar_name from offers where offers.id = ${reviews.entityId} and ${reviews.entityType} = 'offer'),
      (select ar_name from collections where collections.id = ${reviews.entityId} and ${reviews.entityType} = 'collection')
    )`,
    entityNameEn: sql<string | null>`coalesce(
      (select en_name from products where products.id = ${reviews.entityId} and ${reviews.entityType} = 'product'),
      (select en_name from offers where offers.id = ${reviews.entityId} and ${reviews.entityType} = 'offer'),
      (select en_name from collections where collections.id = ${reviews.entityId} and ${reviews.entityType} = 'collection')
    )`
  }).from(reviews).innerJoin(customers, eq(customers.id, reviews.customerId)).orderBy(desc(reviews.createdAt));
  return rows.map((row) => ({
    ...row,
    entityName: { ar: row.entityNameAr ?? "", en: row.entityNameEn ?? "" },
    moderatedAt: row.moderatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}

export async function updateReviewStatusRepo(id: number, status: ReviewStatus, adminUserId: number) {
  const result = await db.update(reviews).set({
    status,
    moderatedByAdminUserId: adminUserId,
    moderatedAt: new Date()
  }).where(eq(reviews.id, id));
  if (result[0].affectedRows === 0) throw new ReviewNotFoundError();
  const [review] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  return review!;
}

export async function hardDeleteReviewRepo(id: number) {
  const result = await db.delete(reviews).where(eq(reviews.id, id));
  if (result[0].affectedRows === 0) throw new ReviewNotFoundError();
}

export async function listOrderReviewEligibilityRepo(customerId: number, orderId: number) {
  const [order] = await db.select({ id: orders.id, paymentStatus: orders.paymentStatus })
    .from(orders).where(and(eq(orders.id, orderId), eq(orders.customerId, customerId))).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const result = [];
  const processedTargets = new Set<string>();
  for (const item of items) {
    let entityType: ReviewEntityType;
    let entityId: number | null;
    if (item.itemType === "product_variant") {
      entityType = "product";
      const [variant] = await db.select({ productId: productVariants.productId }).from(productVariants)
        .where(eq(productVariants.id, item.variantId!)).limit(1);
      entityId = variant?.productId ?? null;
    } else {
      entityType = item.itemType;
      entityId = item.itemType === "offer" ? item.offerId : item.collectionId;
    }
    if (!entityId) continue;
    const targetKey = `${entityType}:${entityId}`;
    if (processedTargets.has(targetKey)) continue;
    processedTargets.add(targetKey);
    const [submission] = await db.select({ id: reviewSubmissions.id }).from(reviewSubmissions)
      .where(and(eq(reviewSubmissions.customerId, customerId), eq(reviewSubmissions.entityType, entityType), eq(reviewSubmissions.entityId, entityId))).limit(1);
    const [review] = submission
      ? await db.select({ status: reviews.status }).from(reviews).where(eq(reviews.submissionId, submission.id)).limit(1)
      : [];
    result.push({
      orderItemId: item.id,
      entityType,
      entityId,
      eligible: order.paymentStatus === "accepted" && !submission,
      submitted: Boolean(submission),
      status: submission ? review?.status ?? "deleted" : null
    });
  }
  return { orderId, paymentStatus: order.paymentStatus, items: result };
}
