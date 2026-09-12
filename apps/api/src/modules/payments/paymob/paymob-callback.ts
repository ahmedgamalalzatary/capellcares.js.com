import { z } from "zod";

const positiveId = z.number().int().positive().safe();
const transactionSchema = z.object({
  id: positiveId,
  order: z.object({ id: positiveId }).passthrough(),
  amount_cents: positiveId,
  currency: z.string().length(3),
  integration_id: positiveId,
  success: z.boolean(),
  pending: z.boolean(),
  is_live: z.boolean(),
  is_auth: z.boolean(),
  is_capture: z.boolean(),
  is_refunded: z.boolean(),
  is_voided: z.boolean(),
  has_parent_transaction: z.boolean(),
  source_data: z.object({ type: z.string() }).passthrough()
}).passthrough();

export function parsePaymobProcessedCallback(input: unknown): z.infer<typeof transactionSchema> | null {
  const parsed = transactionSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
