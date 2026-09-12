import { releaseExpiredCheckoutReservations } from "../../repositories/checkout/checkout-reservation.repository.js";

export function startCheckoutExpiryWorker(options: { intervalMs?: number } = {}): () => void {
  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      await releaseExpiredCheckoutReservations(new Date());
    } catch (error) {
      console.error("Checkout reservation expiry failed", error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => { void sweep(); }, options.intervalMs ?? 60_000);
  void sweep();
  return () => clearInterval(timer);
}
