import { z } from "zod";

/**
 * The compact rating every storefront card carries. Always present so a grid
 * never has to distinguish "not loaded" from "not reviewed" — an unreviewed
 * entity reports zero on both fields.
 */
export const storefrontRatingContract = z
  .object({
    average: z.number().min(0).max(5),
    count: z.number().int().nonnegative()
  })
  // A card hides its stars on a zero count, so an average alongside one would
  // never be seen — and would mean the payload counted and averaged different
  // sets of reviews.
  .refine((rating) => rating.count > 0 ? rating.average >= 1 : rating.average === 0, {
    message: "An unreviewed entity must report a zero average",
    path: ["average"]
  });
