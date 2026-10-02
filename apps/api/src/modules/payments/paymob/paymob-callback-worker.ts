import { startIntervalWorker } from "../../../services/interval-worker.js";
import { claimPaymobCallback } from "./paymob-callback.repository.js";
import { processPaymobCallbackClaim, type PaymobCallbackProcessingOptions } from "./paymob-callback-processing.service.js";

export async function runPaymobCallbackOnce(options: PaymobCallbackProcessingOptions = {}): Promise<boolean> {
  const claim = await claimPaymobCallback({ now: options.now });
  if (!claim) return false;
  await processPaymobCallbackClaim(claim, options);
  return true;
}

/** Until W08 extracts all runners, recovery is owned by the current API runtime. */
export function startPaymobCallbackWorker(): () => Promise<void> {
  return startIntervalWorker(async isStopped => {
    for (let count = 0; count < 10 && !isStopped(); count++) if (!await runPaymobCallbackOnce()) break;
  }, 2000, () => console.error("Paymob callback recovery requires database attention"));
}
