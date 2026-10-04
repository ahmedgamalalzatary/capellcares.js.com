import { loadWorkspaceEnv } from "./config/env.js";
import { createShutdown } from "./services/shutdown.js";

loadWorkspaceEnv();

const { app } = await import("./app.js");
const { syncPermissionCatalog } = await import("./services/erp-permissions.service.js");
const { ensureBootstrapAdmin } = await import("./modules/admin/auth/admin-auth.service.js");
const { startCheckoutExpiryWorker } = await import("./modules/checkout/checkout-expiry-worker.js");
const { startShippingDispatchWorker } = await import("./modules/shipping/shipping-dispatch-worker.js");
const { startShippingSyncWorker } = await import("./modules/shipping/shipping-sync-worker.js");
const { startShippingCancellationWorker } = await import("./modules/shipping/shipping-cancellation-worker.js");
const { startPaymobCallbackWorker } = await import("./modules/payments/paymob/paymob-callback-worker.js");
const { assertShippingStartup } = await import("./modules/shipping/shipping-startup.js");
const { mysqlPool } = await import("@capella/database/src/db");

// Refuse to boot on an invalid active shipping setup, before any worker can act on it. Shipping validation is self-contained, so it never requires admin/JWT/intention secrets.
assertShippingStartup(process.env);

await ensureBootstrapAdmin();
await syncPermissionCatalog();
const stopWorkers = [
  startPaymobCallbackWorker(),
  startCheckoutExpiryWorker(),
  startShippingDispatchWorker(),
  startShippingSyncWorker(),
  startShippingCancellationWorker()
];

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => {
  console.log(`API running on :${port}`);
});

const shutdown = createShutdown(server, stopWorkers, () => mysqlPool.end());
let stopping = false;
const handleShutdown = () => {
  if (stopping) return;
  stopping = true;
  // Finish before Compose's 30-second stop grace period expires.
  const deadline = setTimeout(() => {
    console.error("API shutdown timed out");
    process.exit(1);
  }, 25_000);
  void shutdown().then(() => {
    clearTimeout(deadline);
    process.exit(0);
  }).catch(() => {
    clearTimeout(deadline);
    console.error("API shutdown failed");
    process.exit(1);
  });
};
process.on("SIGTERM", handleShutdown);
process.on("SIGINT", handleShutdown);
