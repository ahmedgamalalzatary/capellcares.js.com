import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { cancellationEnvironment } from "../helpers/bosta-cancellation.js";
import { syncSettings } from "../helpers/bosta-sync.js";
import { deliverySettings, deliveryQuoteSettings } from "../helpers/bosta-delivery.js";

const editing = { accountVerified: true, accountEvidence: "controlled fixture only", accountId: "fixture",
  readContract: { verified: true, evidence: "controlled fixture only", editablePath: ["editAvailability", "editable"], prePickupPath: ["editAvailability", "prePickup"] } };
const quoteSettings = { ...deliveryQuoteSettings, codPricingPolicy: "collection_total" };
const active = { ...cancellationEnvironment, BOSTA_QUOTE_SETTINGS_JSON: JSON.stringify(quoteSettings),
  BOSTA_EDITS_ENABLED: "true", BOSTA_EDIT_SETTINGS_JSON: JSON.stringify(editing) };
async function check(env: Record<string, string | undefined>) {
  const module = await import("../../src/modules/shipping/shipping-readiness.service.js").catch(() => null);
  assert.ok(module?.checkShippingConfiguration, "read-only deployment configuration check is required");
  return module.checkShippingConfiguration(env);
}

test("disabled shipping needs no provider credentials and reports every capability off", async () => {
  assert.deepEqual(await check({}), { valid: true, providerCalls: false, quoting: false, sending: false,
    deliveryRecovery: false, synchronization: false, cancellation: false, edits: false, errors: [] });
});
test("complete fixture contracts enable all configured capabilities without making HTTP requests", async () => {
  assert.deepEqual(await check(active), { valid: true, providerCalls: true, quoting: true, sending: true,
    deliveryRecovery: true, synchronization: true, cancellation: true, edits: true, errors: [] });
});
test("stopping sending preserves configured read-only create recovery", async () => {
  const report = await check({ ...active, BOSTA_SHIPMENT_SENDING_ENABLED: "false" });
  assert.equal(report.valid, true);
  assert.equal(report.sending, false);
  assert.equal(report.deliveryRecovery, true);
});
test("stopping all HTTP calls retains authenticated callback synchronization", async () => {
  const report = await check({ ...active, BOSTA_ENABLED: "false" });
  assert.equal(report.valid, true);
  for (const capability of ["providerCalls", "quoting", "sending", "deliveryRecovery", "cancellation", "edits"] as const) assert.equal(report[capability], false, capability);
  assert.equal(report.synchronization, true);
});
test("missing enabled secrets and malformed evidence produce only static nonsecret failures", async () => {
  for (const patch of [{ BOSTA_API_KEY: "" }, { BOSTA_QUOTE_SETTINGS_JSON: "{private-sentinel" },
    { BOSTA_SYNC_SETTINGS_JSON: "{private-sentinel" }, { BOSTA_EDIT_SETTINGS_JSON: "{private-sentinel" }]) {
    const report = await check({ ...active, ...patch });
    assert.equal(report.valid, false);
    const output = JSON.stringify(report);
    for (const sensitive of [active.BOSTA_API_KEY, active.BOSTA_WEBHOOK_SECRET, "private-sentinel"]) assert.equal(output.includes(sensitive), false);
  }
});
test("activation values reject typos instead of silently treating sending as disabled", async () => {
  for (const name of ["BOSTA_ENABLED", "BOSTA_SHIPMENT_SENDING_ENABLED", "BOSTA_SYNC_ENABLED", "BOSTA_CANCELLATION_ENABLED", "BOSTA_EDITS_ENABLED"]) {
    const report = await check({ ...active, [name]: "tru" });
    assert.equal(report.valid, false, name);
    assert.ok(report.errors.includes(`${name}_INVALID`), name);
  }
});
test("sending without synchronization is rejected before activation", async () => {
  const report = await check({ ...active, BOSTA_SYNC_ENABLED: "false", BOSTA_CANCELLATION_ENABLED: "false", BOSTA_EDITS_ENABLED: "false" });
  assert.equal(report.valid, false);
  assert.ok(report.errors.includes("SENDING_REQUIRES_SYNCHRONIZATION"));
});
test("quote, create and synchronization contracts cannot mix merchant accounts", async () => {
  for (const patch of [
    { BOSTA_QUOTE_SETTINGS_JSON: JSON.stringify({ ...quoteSettings, accountId: "other" }) },
    { BOSTA_SYNC_SETTINGS_JSON: JSON.stringify({ ...syncSettings, accountId: "other" }) },
    { BOSTA_DELIVERY_SETTINGS_JSON: JSON.stringify({ ...deliverySettings, accountId: "other" }) }
  ]) {
    const report = await check({ ...active, ...patch });
    assert.equal(report.valid, false);
    assert.ok(report.errors.includes("SHIPPING_ACCOUNT_MISMATCH"));
  }
});
test("the configured default pickup must match the pricing origin", async () => {
  const report = await check({ ...active, BOSTA_DELIVERY_SETTINGS_JSON: JSON.stringify({ ...deliverySettings, defaultPickupCity: "other-city" }) });
  assert.equal(report.valid, false);
  assert.ok(report.errors.includes("PICKUP_CITY_MISMATCH"));
});
test("deployment CLI returns failure and a redacted report for invalid active configuration", () => {
  let result: { status?: number | null; stdout?: Buffer | string } | undefined;
  try {
    execFileSync(process.execPath, ["--import", "tsx", "src/scripts/check-shipping.ts"], {
      env: { ...process.env, ...active, BOSTA_QUOTE_SETTINGS_JSON: "{private-sentinel" }, stdio: "pipe", timeout: 10000 });
  } catch (error) { result = error as typeof result; }
  assert.equal(result?.status, 1);
  const output = String(result?.stdout ?? "");
  assert.ok(output.trim(), "deployment CLI must return a configuration report");
  const report = JSON.parse(output);
  assert.equal(report.valid, false);
  assert.ok(report.errors.includes("QUOTE_CONFIGURATION_INVALID"));
  assert.equal(output.includes("private-sentinel"), false);
});
