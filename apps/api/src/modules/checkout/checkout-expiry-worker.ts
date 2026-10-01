import { releaseExpiredCheckoutReservations } from "../../repositories/checkout/checkout-reservation.repository.js";
import { expirePendingCodOrders } from "../../repositories/order.repository.js";
import { startIntervalWorker } from "../../services/interval-worker.js";

export function startCheckoutExpiryWorker(options: { intervalMs?: number } = {}): () => Promise<void> {
  return startIntervalWorker(async () => {
    await releaseExpiredCheckoutReservations(new Date());
    await expirePendingCodOrders(new Date());
  }, options.intervalMs ?? 60_000, (error) => console.error("Checkout reservation expiry failed", error));
}
