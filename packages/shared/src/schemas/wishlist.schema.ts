import { z } from "zod";

export const wishlistItemSchema = z.object({
  id: z.number().int().positive(),
  customerId: z.number().int().positive(),
  productId: z.number().int().positive()
});
