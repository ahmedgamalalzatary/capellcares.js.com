import { z } from "zod";
import { nullableYouTubeUrlSchema } from "./youtube-url.schema.js";

const timestampString = z.string().min(1).refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: "Invalid timestamp"
});

const discountSchema = z.object({
  id: z.number().int().positive().optional(),
  variantId: z.number().int().positive().optional(),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().positive(),
  startsAt: timestampString,
  endsAt: timestampString,
  status: z.enum(["active", "inactive"])
}).superRefine((discount, ctx) => {
  if (new Date(discount.startsAt).getTime() >= new Date(discount.endsAt).getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Discount start must be before end",
      path: ["endsAt"]
    });
  }
});

export const productVariantSchema = z.object({
  id: z.number().int().positive(),
  productId: z.number().int().positive(),
  sizeLabel: z.string().min(1),
  sellingPrice: z.number().nonnegative(),
  stockQty: z.number().int().nonnegative(),
  sortOrder: z.number().int(),
  discount: discountSchema.nullable().optional()
}).superRefine((variant, ctx) => {
  const discount = variant.discount;
  if (!discount) return;

  if (discount.type === "percentage" && discount.value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Percentage discount cannot exceed 100",
      path: ["discount", "value"]
    });
  }

  if (discount.type === "fixed" && discount.value >= variant.sellingPrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Fixed discount must be less than selling price",
      path: ["discount", "value"]
    });
  }
});

const entityImageMediaSchema = z.object({
  type: z.literal("image"),
  arUrl: z.string().min(1).max(1024).nullable(),
  enUrl: z.string().min(1).max(1024).nullable()
}).refine((media) => media.arUrl !== null || media.enUrl !== null, {
  message: "An image URL is required for at least one language"
});

const entityVideoMediaSchema = z.object({
  type: z.literal("video"),
  url: z.string().min(1).max(1024)
});

export const entityMediaSchema = z.union([entityImageMediaSchema, entityVideoMediaSchema]);

/** @deprecated Use entityMediaSchema. */
export const productMediaSchema = entityMediaSchema;

export const productSchema = z.object({
  id: z.number().int().positive(),
  sku: z.string().min(1),
  slug: z.string().min(1),
  arName: z.string().min(1),
  enName: z.string().min(1),
  buyingPrice: z.number().nonnegative(),
  keywords: z.array(z.string()),
  arDescription: z.string().nullable(),
  enDescription: z.string().nullable(),
  arIngredients: z.string().nullable(),
  enIngredients: z.string().nullable(),
  arHowToUse: z.string().nullable(),
  enHowToUse: z.string().nullable(),
  arWarnings: z.string().nullable(),
  enWarnings: z.string().nullable(),
  youtubeUrl: nullableYouTubeUrlSchema,
  imagePath: z.string().nullable(),
  hoverImagePath: z.string().nullable(),
  arHoverImagePath: z.string().nullable().optional(),
  enHoverImagePath: z.string().nullable().optional(),
  media: z.array(entityMediaSchema),
  status: z.enum(["active", "inactive"]),
  isNew: z.boolean(),
  isBestseller: z.boolean(),
  categoryId: z.number().int().positive(),
  deletedAt: z.string().nullable(),
  variants: z.array(productVariantSchema)
});
