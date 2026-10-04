import { releaseExpiredCheckoutReservations } from "./checkout-reservation.repository.js";
import { expirePendingCodOrders } from "../orders/order.repository.js";
import { startIntervalWorker } from "../../services/interval-worker.js";

export function startCheckoutExpiryWorker(
  options: { intervalMs?: number; reconciliationEnabled?: boolean } = {}
): () => Promise<void> {
  return startIntervalWorker(async isStopped => {
    await releaseExpiredCheckoutReservations(new Date(), { isStopped, reconciliationEnabled: options.reconciliationEnabled });
    await expirePendingCodOrders(new Date(), { isStopped });
  }, options.intervalMs ?? 60_000, (error) => console.error("Checkout reservation expiry failed", error));
}
