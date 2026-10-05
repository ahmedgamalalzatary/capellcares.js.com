import { z } from "zod";

/**
 * The one hover-image shape every purchasable entity shares: `hoverImagePath` is the
 * legacy/English path, `arHoverImagePath` the Arabic overlay, and `enHoverImagePath`
 * the explicit English override.
 */
export const hoverImageSchema = z.object({
  hoverImagePath: z.string().nullable(),
  arHoverImagePath: z.string().nullable().optional(),
  enHoverImagePath: z.string().nullable().optional()
});
