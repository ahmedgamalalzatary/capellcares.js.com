import { z } from "zod";
import { cartLinesSchema } from "./cart.schema.js";
import { adviceSchema } from "./advice.schema.js";
import { reviewEntityTypeSchema } from "./review.schema.js";

const id = z.number().int().positive().safe();
const money = z.number().finite().nonnegative();
export const cartResponseSchema = z.object({ lines: cartLinesSchema });
export const announcementResponseSchema = z.object({ items: z.array(z.string()) });
const orderItemSchema = z.object({
  id, orderId: id, itemType: z.enum(["product_variant", "offer", "collection"]),
  variantId: id.nullable(), offerId: id.nullable(), collectionId: id.nullable(),
  qty: z.number().int().positive(), unitPrice: money, lineTotal: money,
  snapshotNameAr: z.string().nullable(), snapshotNameEn: z.string().nullable(), snapshotSizeLabel: z.string().nullable()
}).passthrough();
export const customerOrderSummarySchema = z.object({
  id, orderCode: z.string().min(1), customerType: z.enum(["guest", "registered"]), customerId: id.nullable(),
  fullName: z.string(), phone: z.string(), email: z.string(), governorate: z.string(), cityArea: z.string(),
  addressLine: z.string(), buildingApartment: z.string(), notes: z.string().nullable(),
  paymentMethod: z.literal("cod"), paymentStatus: z.enum(["pending", "accepted", "denied"]),
  totalAmount: money, createdAt: z.string().datetime(),
  items: z.array(orderItemSchema).optional()
}).passthrough();
export const customerOrderSchema = customerOrderSummarySchema.extend({ items: z.array(orderItemSchema) });
export const customerOrdersSchema = z.object({ items: z.array(customerOrderSummarySchema) });
export const adviceResponseSchema = z.object({ items: z.array(adviceSchema.extend({
  createdAt: z.string(), updatedAt: z.string()
})) });
const bilingual = z.object({ ar: z.string(), en: z.string() });
export const reviewPromptResponseSchema = z.object({
  entityType: reviewEntityTypeSchema, entityId: id, name: bilingual,
  imagePath: z.string().nullable(), href: z.string().min(1)
});
export const wishlistEntryResponseSchema = reviewPromptResponseSchema.extend({
  href: z.string().nullable(), availability: z.enum(["available", "unavailable"])
});
const count = z.number().int().nonnegative();
export const reviewPageResponseSchema = z.object({
  summary: z.object({ averageRating: z.number().min(0).max(5), reviewCount: count,
    distribution: z.object({ 1: count, 2: count, 3: count, 4: count, 5: count }) }),
  items: z.array(z.object({ id, firstName: z.string(), rating: z.number().int().min(1).max(5),
    comment: z.string(), createdAt: z.string().datetime(), verifiedPurchase: z.literal(true) })),
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: count, totalPages: count })
});
export const reviewCreatedResponseSchema = z.object({ id });
export const mutationOkSchema = z.object({ ok: z.literal(true) });
