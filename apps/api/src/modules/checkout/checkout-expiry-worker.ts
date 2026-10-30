import { expirePendingCodOrders } from "../orders/order.repository.js";
import { startIntervalWorker } from "../../services/interval-worker.js";

export function startCheckoutExpiryWorker(options: { intervalMs?: number } = {}): () => Promise<void> {
  return startIntervalWorker(async isStopped => {
    await expirePendingCodOrders(new Date(), { isStopped });
  }, options.intervalMs ?? 60_000, (error) => console.error("Order expiry failed", error));
}
