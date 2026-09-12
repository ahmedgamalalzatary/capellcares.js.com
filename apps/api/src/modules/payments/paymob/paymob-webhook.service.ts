import { createHash } from "node:crypto";
import { db } from "@capella/database/src/db";
import { paymentWebhookEvents } from "@capella/database/drizzle/schema";

function isDuplicateEntry(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code === "ER_DUP_ENTRY" || candidate.cause?.code === "ER_DUP_ENTRY";
}

export async function recordPaymobTransaction(
  transaction: Record<string, unknown>,
  processingStatus: "processed" | "rejected"
): Promise<void> {
  const identity = JSON.stringify({
    id: transaction.id,
    success: transaction.success,
    pending: transaction.pending,
    is_auth: transaction.is_auth,
    is_capture: transaction.is_capture,
    is_refunded: transaction.is_refunded,
    is_voided: transaction.is_voided,
    refunded_amount_cents: transaction.refunded_amount_cents,
    captured_amount: transaction.captured_amount
  });
  const eventFingerprint = createHash("sha256").update(identity).digest("hex");
  try {
    await db.insert(paymentWebhookEvents).values({
      provider: "paymob",
      callbackType: "transaction",
      eventFingerprint,
      processingStatus,
      processedAt: new Date()
    });
  } catch (error) {
    if (!isDuplicateEntry(error)) throw error;
  }
}
