import { and, avg, count, desc, eq, inArray, isNotNull, isNull, like, or, sql } from "drizzle-orm";

import {
  orderItems,
  orders,
  offers,
  collections,
  products,
  productVariants,
  customers,
  reviewPromptStates,
  reviewSubmissionHistory,
  reviews,
  type reviewEntityTypes
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

export type ReviewEntityType = (typeof reviewEntityTypes)[number];

export class ReviewEligibilityError extends Error {}
export class ReviewAlreadyExistsError extends Error {}

export async function findReviewTargetSlug(entityType: ReviewEntityType, entityId: number) {
  if (entityType === "product") {
    const [target] = await db.select({ slug: products.slug }).from(products).where(eq(products.id, entityId)).limit(1);
    return target?.slug ?? null;
  }
  if (entityType === "offer") {
    const [target] = await db.select({ slug: offers.slug }).from(offers).where(eq(offers.id, entityId)).limit(1);
    return target?.slug ?? null;
  }
  const [target] = await db.select({ slug: collections.slug }).from(collections).where(eq(collections.id, entityId)).limit(1);
  return target?.slug ?? null;
}

export async function findReviewTargetByReviewId(reviewId: number) {
  const [review] = await db
    .select({ entityType: reviews.entityType, entityId: reviews.entityId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);
  if (!review) return null;
  const slug = await findReviewTargetSlug(review.entityType, review.entityId);
  return slug ? { entityType: review.entityType, slug } : null;
}

function isDuplicateReviewError(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } } | undefined;
  return candidate?.code === "ER_DUP_ENTRY" || candidate?.cause?.code === "ER_DUP_ENTRY";
}

async function findAcceptedOrderItem(
  executor: Pick<typeof db, "select">,
  customerId: number,
  entityType: ReviewEntityType,
  entityId: number
) {
  const baseConditions = [
    eq(orders.customerId, customerId),
    eq(orders.customerType, "registered"),
    eq(orders.paymentStatus, "accepted")
  ];

  if (entityType === "product") {
    const [row] = await executor
      .select({ id: orderItems.id })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .where(and(...baseConditions, eq(orderItems.itemType, "product_variant"), eq(productVariants.productId, entityId)))
      .limit(1)
      .for("update");
    return row ?? null;
  }

  const targetCondition = entityType === "offer"
    ? eq(orderItems.offerId, entityId)
    : eq(orderItems.collectionId, entityId);
  const [row] = await executor
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(...baseConditions, eq(orderItems.itemType, entityType), targetCondition))
    .limit(1)
    .for("update");
  return row ?? null;
}

export async function createVerifiedReview(input: {
  customerId: number;
  entityType: ReviewEntityType;
  entityId: number;
  rating: number;
  comment: string;
}) {
  let created: { id: number };
  try {
    created = await db.transaction(async (tx) => {
      const orderItem = await findAcceptedOrderItem(tx, input.customerId, input.entityType, input.entityId);
      if (!orderItem) {
        throw new ReviewEligibilityError("A paid purchase is required to review this item");
      }
      await tx.insert(reviewSubmissionHistory).values({
        customerId: input.customerId,
        orderItemId: orderItem.id,
        entityType: input.entityType,
        entityId: input.entityId
      });
      const [inserted] = await tx.insert(reviews).values({
        customerId: input.customerId,
        orderItemId: orderItem.id,
        entityType: input.entityType,
        entityId: input.entityId,
        rating: input.rating,
        comment: input.comment,
        status: "active"
      }).$returningId();
      return inserted;
    });
  } catch (error) {
    if (isDuplicateReviewError(error)) {
      throw new ReviewAlreadyExistsError("You have already reviewed this item");
    }
    throw error;
  }
  const [review] = await db.select().from(reviews).where(eq(reviews.id, created.id)).limit(1);
  return review!;
}

export async function listPublicReviews(input: {
  entityType: ReviewEntityType;
  entityId: number;
  page: number;
  pageSize: number;
}) {
  const visibleConditions = and(
    eq(reviews.entityType, input.entityType),
    eq(reviews.entityId, input.entityId),
    eq(reviews.status, "active"),
    isNull(reviews.deletedAt)
  );
  const [[summary], distributionRows, rows] = await Promise.all([
    db
      .select({ averageRating: avg(reviews.rating), reviewCount: count() })
      .from(reviews)
      .where(visibleConditions),
    db
      .select({ rating: reviews.rating, reviewCount: count() })
      .from(reviews)
      .where(visibleConditions)
      .groupBy(reviews.rating),
    db
      .select({
        id: reviews.id,
        customerName: customers.name,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt
      })
      .from(reviews)
      .innerJoin(customers, eq(customers.id, reviews.customerId))
      .where(visibleConditions)
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize)
  ]);

  const reviewCount = Number(summary?.reviewCount ?? 0);
  const distribution: Record<"1" | "2" | "3" | "4" | "5", number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0
  };
  for (const row of distributionRows) {
    if (row.rating >= 1 && row.rating <= 5) {
      distribution[String(row.rating) as keyof typeof distribution] = Number(row.reviewCount);
    }
  }

  return {
    summary: {
      averageRating: reviewCount === 0 ? 0 : Number(Number(summary?.averageRating ?? 0).toFixed(1)),
      reviewCount,
      distribution
    },
    items: rows.map((row) => ({
      id: row.id,
      firstName: row.customerName.trim().split(/\s+/u)[0] || "Customer",
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt,
      verifiedPurchase: true
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: reviewCount,
      totalPages: reviewCount === 0 ? 0 : Math.ceil(reviewCount / input.pageSize)
    }
  };
}

export async function claimReviewPrompt(customerId: number) {
  const [latestOrder] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(
      eq(orders.customerId, customerId),
      eq(orders.customerType, "registered"),
      eq(orders.paymentStatus, "accepted")
    ))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(1);
  if (!latestOrder) return null;

  const reviewTargetMatch = or(
    and(
      eq(orderItems.itemType, "product_variant"),
      eq(reviews.entityType, "product"),
      eq(reviews.entityId, productVariants.productId)
    ),
    and(
      eq(orderItems.itemType, "offer"),
      eq(reviews.entityType, "offer"),
      eq(reviews.entityId, orderItems.offerId)
    ),
    and(
      eq(orderItems.itemType, "collection"),
      eq(reviews.entityType, "collection"),
      eq(reviews.entityId, orderItems.collectionId)
    )
  );
  const promptTargetMatch = or(
    and(
      eq(orderItems.itemType, "product_variant"),
      eq(reviewPromptStates.entityType, "product"),
      eq(reviewPromptStates.entityId, productVariants.productId)
    ),
    and(
      eq(orderItems.itemType, "offer"),
      eq(reviewPromptStates.entityType, "offer"),
      eq(reviewPromptStates.entityId, orderItems.offerId)
    ),
    and(
      eq(orderItems.itemType, "collection"),
      eq(reviewPromptStates.entityType, "collection"),
      eq(reviewPromptStates.entityId, orderItems.collectionId)
    )
  );
  const submissionTargetMatch = or(
    and(
      eq(orderItems.itemType, "product_variant"),
      eq(reviewSubmissionHistory.entityType, "product"),
      eq(reviewSubmissionHistory.entityId, productVariants.productId)
    ),
    and(
      eq(orderItems.itemType, "offer"),
      eq(reviewSubmissionHistory.entityType, "offer"),
      eq(reviewSubmissionHistory.entityId, orderItems.offerId)
    ),
    and(
      eq(orderItems.itemType, "collection"),
      eq(reviewSubmissionHistory.entityType, "collection"),
      eq(reviewSubmissionHistory.entityId, orderItems.collectionId)
    )
  );

  const [candidate] = await db
    .select({
      orderItemId: orderItems.id,
      orderId: orders.id,
      itemType: orderItems.itemType,
      productId: productVariants.productId,
      offerId: orderItems.offerId,
      collectionId: orderItems.collectionId,
      snapshotNameAr: orderItems.snapshotNameAr,
      snapshotNameEn: orderItems.snapshotNameEn
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .leftJoin(reviews, and(eq(reviews.customerId, customerId), reviewTargetMatch))
    .leftJoin(
      reviewSubmissionHistory,
      and(eq(reviewSubmissionHistory.customerId, customerId), submissionTargetMatch)
    )
    .leftJoin(
      reviewPromptStates,
      and(
        eq(reviewPromptStates.customerId, customerId),
        or(eq(reviewPromptStates.orderId, orders.id), promptTargetMatch)
      )
    )
    .where(and(
      eq(orders.id, latestOrder.id),
      eq(orders.customerId, customerId),
      eq(orders.customerType, "registered"),
      eq(orders.paymentStatus, "accepted"),
      inArray(orderItems.itemType, ["product_variant", "offer", "collection"]),
      isNull(reviews.id),
      isNull(reviewSubmissionHistory.id),
      isNull(reviewPromptStates.id)
    ))
    .orderBy(desc(orders.createdAt), desc(orderItems.id))
    .limit(1);

  if (!candidate) return null;
  const entityType: ReviewEntityType = candidate.itemType === "product_variant" ? "product" : candidate.itemType;
  const entityId = entityType === "product"
    ? candidate.productId
    : entityType === "offer"
      ? candidate.offerId
      : candidate.collectionId;
  if (!entityId) return null;

  const table = entityType === "product" ? products : entityType === "offer" ? offers : collections;
  const [target] = await db
    .select({ id: table.id, slug: table.slug, arName: table.arName, enName: table.enName, imagePath: table.imagePath })
    .from(table)
    .where(eq(table.id, entityId))
    .limit(1);
  if (!target) return null;

  try {
    await db.insert(reviewPromptStates).values({
      customerId,
      orderId: candidate.orderId,
      orderItemId: candidate.orderItemId,
      entityType,
      entityId
    });
  } catch (error) {
    if (isDuplicateReviewError(error)) return null;
    throw error;
  }

  return {
    entityType,
    entityId,
    name: {
      ar: candidate.snapshotNameAr || target.arName,
      en: candidate.snapshotNameEn || target.enName
    },
    imagePath: target.imagePath,
    href: `/${entityType === "product" ? "products" : entityType === "offer" ? "offers" : "collections"}/${target.slug}`
  };
}

export async function attachReviewEligibilityToOrder<
  T extends { paymentStatus: string; items: Array<{ itemType: string; variantId: number | null; offerId: number | null; collectionId: number | null }> }
>(order: T, customerId: number) {
  const variantIds = order.items
    .filter((item) => item.itemType === "product_variant" && item.variantId != null)
    .map((item) => item.variantId!);
  const variantRows = variantIds.length === 0
    ? []
    : await db
        .select({ id: productVariants.id, productId: productVariants.productId })
        .from(productVariants)
        .where(or(...variantIds.map((id) => eq(productVariants.id, id))));
  const productIdByVariantId = new Map(variantRows.map((row) => [row.id, row.productId]));
  const [customerReviews, submissionHistory] = await Promise.all([
    db
      .select({ entityType: reviews.entityType, entityId: reviews.entityId })
      .from(reviews)
      .where(eq(reviews.customerId, customerId)),
    db
      .select({ entityType: reviewSubmissionHistory.entityType, entityId: reviewSubmissionHistory.entityId })
      .from(reviewSubmissionHistory)
      .where(eq(reviewSubmissionHistory.customerId, customerId))
  ]);
  const reviewedTargets = new Set(
    [...customerReviews, ...submissionHistory].map((review) => `${review.entityType}:${review.entityId}`)
  );

  return {
    ...order,
    items: order.items.map((item) => {
      const entityType: ReviewEntityType = item.itemType === "product_variant" ? "product" : item.itemType as ReviewEntityType;
      const entityId = entityType === "product"
        ? productIdByVariantId.get(item.variantId ?? -1) ?? null
        : entityType === "offer"
          ? item.offerId
          : item.collectionId;
      if (!entityId) return { ...item, review: null };
      return {
        ...item,
        review: {
          entityType,
          entityId,
          state: order.paymentStatus !== "accepted"
            ? "unavailable" as const
            : reviewedTargets.has(`${entityType}:${entityId}`)
              ? "submitted" as const
              : "eligible" as const
        }
      };
    })
  };
}

export async function listAdminReviews(input: {
  page: number;
  pageSize: number;
  deleted: boolean;
  status?: "active" | "inactive";
  entityType?: ReviewEntityType;
  q?: string;
}) {
  const search = input.q?.trim();
  const conditions = [input.deleted ? isNotNull(reviews.deletedAt) : isNull(reviews.deletedAt)];
  if (input.status) conditions.push(eq(reviews.status, input.status));
  if (input.entityType) conditions.push(eq(reviews.entityType, input.entityType));
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(
      like(customers.name, pattern),
      like(customers.email, pattern),
      like(orders.orderCode, pattern),
      like(reviews.comment, pattern),
      like(products.arName, pattern),
      like(products.enName, pattern),
      like(offers.arName, pattern),
      like(offers.enName, pattern),
      like(collections.arName, pattern),
      like(collections.enName, pattern)
    )!);
  }
  const where = and(...conditions);
  const [countRows, rows] = await Promise.all([
    db.select({ total: count() })
      .from(reviews)
      .innerJoin(customers, eq(customers.id, reviews.customerId))
      .innerJoin(orderItems, eq(orderItems.id, reviews.orderItemId))
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .leftJoin(products, and(eq(reviews.entityType, "product"), eq(products.id, reviews.entityId)))
      .leftJoin(offers, and(eq(reviews.entityType, "offer"), eq(offers.id, reviews.entityId)))
      .leftJoin(collections, and(eq(reviews.entityType, "collection"), eq(collections.id, reviews.entityId)))
      .where(where),
    db.select({
        id: reviews.id,
        customerName: customers.name,
        customerEmail: customers.email,
        entityType: reviews.entityType,
        entityId: reviews.entityId,
        entityNameAr: sql<string | null>`coalesce(${products.arName}, ${offers.arName}, ${collections.arName})`,
        entityNameEn: sql<string | null>`coalesce(${products.enName}, ${offers.enName}, ${collections.enName})`,
        orderId: orders.id,
        orderCode: orders.orderCode,
        rating: reviews.rating,
        comment: reviews.comment,
        status: reviews.status,
        deletedAt: reviews.deletedAt,
        createdAt: reviews.createdAt
      })
      .from(reviews)
      .innerJoin(customers, eq(customers.id, reviews.customerId))
      .innerJoin(orderItems, eq(orderItems.id, reviews.orderItemId))
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .leftJoin(products, and(eq(reviews.entityType, "product"), eq(products.id, reviews.entityId)))
      .leftJoin(offers, and(eq(reviews.entityType, "offer"), eq(offers.id, reviews.entityId)))
      .leftJoin(collections, and(eq(reviews.entityType, "collection"), eq(collections.id, reviews.entityId)))
      .where(where)
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize)
  ]);
  const total = Number(countRows[0]?.total ?? 0);
  return {
    items: rows.map((row) => ({
      id: row.id,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      entityType: row.entityType,
      entityId: row.entityId,
      entityName: {
        ar: row.entityNameAr ?? "عنصر محذوف",
        en: row.entityNameEn ?? "Deleted item"
      },
      orderId: row.orderId,
      orderCode: row.orderCode,
      rating: row.rating,
      comment: row.comment,
      status: row.status,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize)
    }
  };
}

export async function toggleReviewStatus(id: number) {
  const result = await db
    .update(reviews)
    .set({ status: sql`case when ${reviews.status} = 'active' then 'inactive' else 'active' end` })
    .where(and(eq(reviews.id, id), isNull(reviews.deletedAt)));
  if (Number(result[0]?.affectedRows ?? 0) === 0) return null;
  const [updated] = await db.select({ status: reviews.status }).from(reviews).where(eq(reviews.id, id)).limit(1);
  return updated ? { id, status: updated.status } : null;
}

export async function softDeleteReview(id: number) {
  const result = await db
    .update(reviews)
    .set({ deletedAt: new Date() })
    .where(and(eq(reviews.id, id), isNull(reviews.deletedAt)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function restoreReview(id: number) {
  const result = await db
    .update(reviews)
    .set({ deletedAt: null })
    .where(and(eq(reviews.id, id), isNotNull(reviews.deletedAt)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function permanentlyDeleteReview(id: number) {
  const result = await db.delete(reviews).where(and(eq(reviews.id, id), isNotNull(reviews.deletedAt)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
