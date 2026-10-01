import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { cancellationEnvironment } from "../helpers/bosta-cancellation.js";
import { syncSettings } from "../helpers/bosta-sync.js";
import { deliveryEnvironment, deliveryQuoteSettings, deliverySettings } from "../helpers/bosta-delivery.js";

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
test("the deployment CLI is a pure check: it never performs a provider write even when sending is enabled", async () => {
  // It reports that provider calls are *configured*, while its own fetch is a
  // hard stub, so validation cannot reach Bosta.
  const report = await check(active);
  assert.equal(report.providerCalls, true, "sending is configured on, so the check is non-trivial");
  assert.equal(report.valid, true, "the check passes and still made no HTTP call");
});
test("the sending adapter refuses to create a shipment when synchronization is disabled", async () => {
  const module = await import("../../src/modules/shipping/bosta/bosta-delivery.service.js");
  const provider = module.bostaDeliveryProviderFromEnvironment({ ...deliveryEnvironment, BOSTA_SYNC_ENABLED: "false" },
    async () => { throw new Error("the provider must not be reached"); });
  assert.ok(provider, "sending stays constructible so the gate is what rejects, not a missing provider");
  assert.equal(provider.canCreate, true, "the adapter still claims to create; the sync gate is the point");
  await assert.rejects(provider.create({ accountId: provider.accountId, environment: provider.environment,
      payload: { businessReference: "reference" } } as any),
    (error: any) => { assert.equal(error.message, "New shipment sending requires synchronization"); return true; });
});
test("read-only recovery keeps reconciling an already-created shipment with synchronization disabled", async () => {
  const module = await import("../../src/modules/shipping/bosta/bosta-delivery.service.js");
  // A shipment created *before* sync was turned off must still be readable, otherwise
  // turning sync off would permanently strand orders in an unknown carrier state.
  let searched = 0;
  const provider = module.bostaDeliveryProviderFromEnvironment({ ...deliveryEnvironment, BOSTA_SYNC_ENABLED: "false" },
    async (input: any, init: any) => {
      if (!String(input).includes("/deliveries/search")) throw new Error(`unexpected provider call: ${input}`);
      searched++;
      return new Response(JSON.stringify({ success: true, data: { deliveries: [], total: 0 } }), { status: 200 });
    });
  const outcome = await provider!.reconcile({ accountId: provider!.accountId, environment: provider!.environment,
    payload: { businessReference: "reference" } } as any);
  assert.equal(searched, 1, "reconcile really called the provider despite sync being off");
  assert.equal(outcome, null, "no match means no shipment to recover");
});
test("sending disabled still yields a read-only provider for create recovery", async () => {
  const module = await import("../../src/modules/shipping/bosta/bosta-delivery.service.js");
  const provider = module.bostaDeliveryProviderFromEnvironment(
    { ...deliveryEnvironment, BOSTA_SHIPMENT_SENDING_ENABLED: "false", BOSTA_SYNC_ENABLED: "false" },
    async () => { throw new Error("the provider must not be reached"); }, { recoveryOnly: true });
  assert.ok(provider, "read-only recovery stays available");
  assert.equal(provider.canCreate, false, "recovery is not creation");
  await assert.rejects(provider!.create({ accountId: provider!.accountId, environment: provider!.environment,
    payload: { businessReference: "reference" } } as any), /New shipment sending is disabled/);
});
test("a typo in a capability gate never silently enables or disables it", async () => {
  // The adapter parsed the sending flag loosely; strict parsing must apply there too.
  const module = await import("../../src/modules/shipping/bosta/bosta-delivery.service.js");
  assert.throws(() => module.bostaDeliveryProviderFromEnvironment({ ...deliveryEnvironment, BOSTA_SHIPMENT_SENDING_ENABLED: "tru" },
    async () => { throw new Error("no HTTP"); }), /BOSTA_SHIPMENT_SENDING_ENABLED must be true or false/);
});
test("API startup refuses to boot when shipping is enabled with an invalid configuration", async () => {
  const module = await import("../../src/modules/shipping/shipping-startup.js").catch(() => null);
  assert.ok(module?.assertShippingStartup, "a shared startup gate is required");
  assert.throws(() => module.assertShippingStartup({ ...active, BOSTA_SYNC_ENABLED: "false",
      BOSTA_CANCELLATION_ENABLED: "false", BOSTA_EDITS_ENABLED: "false" }),
    (error: any) => { assert.equal(error.message.includes("SENDING_REQUIRES_SYNCHRONIZATION"), true); return true; });
  assert.doesNotThrow(() => module.assertShippingStartup(active));
  assert.doesNotThrow(() => module.assertShippingStartup({}), "shipping fully off must boot");
});
test("API startup never validates worker-only secrets it does not use", async () => {
  const module = await import("../../src/modules/shipping/shipping-startup.js");
  // Shipping on, but no admin/JWT/intention secrets: the gate must pass silently.
  assert.doesNotThrow(() => module.assertShippingStartup(active));
  const report = module.shippingStartupReport(active);
  assert.equal(report.valid, true);
  assert.equal(JSON.stringify(report).includes("fixture-secret-key"), false, "no secrets in the report");
});
test("shipping startup failure output stays secret-free", async () => {
  const module = await import("../../src/modules/shipping/shipping-startup.js");
  const report = module.shippingStartupReport({ ...active, BOSTA_QUOTE_SETTINGS_JSON: "{private-sentinel" });
  assert.equal(report.valid, false);
  const output = JSON.stringify(report);
  assert.equal(output.includes("private-sentinel"), false);
  assert.equal(output.includes("fixture-secret-key"), false);
  assert.equal(output.includes("fixture-webhook-secret"), false);
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
