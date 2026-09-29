import { loadWorkspaceEnv } from "../config/env.js";

try {
  loadWorkspaceEnv();
  const { checkShippingConfiguration } = await import("../modules/shipping/shipping-readiness.service.js");
  const report = checkShippingConfiguration(process.env);
  console.log(JSON.stringify(report));
  process.exitCode = report.valid ? 0 : 1;
} catch {
  // File/import errors must not print environment values, credentials or account evidence.
  console.log(JSON.stringify({ valid: false, errors: ["CONFIGURATION_CHECK_FAILED"] }));
  process.exitCode = 1;
}
