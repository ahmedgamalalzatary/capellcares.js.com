import { startIntervalWorker } from "../../../services/interval-worker.js";
import { resolvePaymobConfig } from "./paymob-config.js";
import { runPaymobReconciliationOnce } from "./paymob-reconciliation.service.js";

/** Recovers payments whose callback never arrived, by inquiring the provider with the stored order id. It needs the inquiry API key; without it there is no authenticated read possible, so the worker is a no-op and expiry keeps its existing behaviour rather than holding stock nothing can resolve. */
export function startPaymobReconciliationWorker(): () => Promise<void> {
  if (!resolvePaymobConfig().apiKey) return async () => {};
  return startIntervalWorker(async (isStopped) => {
    for (let count = 0; count < 10 && !isStopped(); count++) {
      if (!await runPaymobReconciliationOnce()) break;
    }
  }, 15_000, () => console.error("Paymob missed-callback reconciliation requires database attention"));
}
