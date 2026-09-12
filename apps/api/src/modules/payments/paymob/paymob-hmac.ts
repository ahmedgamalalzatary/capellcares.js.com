import { createHmac, timingSafeEqual } from "node:crypto";

type PaymobTransaction = Record<string, unknown> & {
  order?: { id?: unknown };
  source_data?: { pan?: unknown; sub_type?: unknown; type?: unknown };
};

function serialize(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function transactionHmacInput(transaction: PaymobTransaction): string {
  return [
    transaction.amount_cents,
    transaction.created_at,
    transaction.currency,
    transaction.error_occured,
    transaction.has_parent_transaction,
    transaction.id,
    transaction.integration_id,
    transaction.is_3d_secure,
    transaction.is_auth,
    transaction.is_capture,
    transaction.is_refunded,
    transaction.is_standalone_payment,
    transaction.is_voided,
    transaction.order?.id,
    transaction.owner,
    transaction.pending,
    transaction.source_data?.pan,
    transaction.source_data?.sub_type,
    transaction.source_data?.type,
    transaction.success
  ].map(serialize).join("");
}

export function verifyPaymobTransactionHmac(input: {
  transaction: PaymobTransaction;
  receivedHmac: string;
  secret: string;
}): boolean {
  if (!/^[a-f\d]{128}$/i.test(input.receivedHmac) || input.secret.length === 0) {
    return false;
  }

  const calculated = createHmac("sha512", input.secret)
    .update(transactionHmacInput(input.transaction), "utf8")
    .digest();
  const received = Buffer.from(input.receivedHmac, "hex");
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}
