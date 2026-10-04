import { checkShippingConfiguration } from "./shipping-readiness.service.js";

/** Startup gate shared by the API and the workers. It reuses the same side-effect-free configuration check as the deployment CLI, so an invalid active shipping setup is refused at boot instead of surfacing later as unexplained worker failures; it deliberately validates only shipping configuration and must never require the admin, JWT or payment-intention secrets a given process does not use. */
export function shippingStartupReport(env: Record<string, string | undefined> = process.env) {
  return checkShippingConfiguration(env);
}

export function assertShippingStartup(env: Record<string, string | undefined> = process.env): void {
  const report = shippingStartupReport(env);
  // The report carries codes only — never secret material — so it is safe to log.
  if (!report.valid) throw new Error(`Shipping configuration is invalid: ${report.errors.join(", ")}`);
}