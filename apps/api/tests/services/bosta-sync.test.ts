import assert from "node:assert/strict";
import test from "node:test";
import { syncEnvironment as env, syncSettings, webhookFixture, readFixture } from "../helpers/bosta-sync.js";

async function runtime(environment = env, fetchImpl: typeof fetch = async () => { throw new Error("Unexpected network call"); }) {
  const module = await import("../../src/modules/shipping/bosta/bosta-sync.service.js").catch(() => null);
  assert.ok(module?.resolveBostaSyncRuntime, "verified Bosta synchronization runtime is required");
  return module.resolveBostaSyncRuntime(environment, fetchImpl);
}

test("synchronization stays off by default and rejects unverified account, webhook or read contracts", async () => {
  assert.equal(await runtime({ ...env, BOSTA_SYNC_ENABLED: "false" }), null);
  for (const settings of [{ ...syncSettings, accountVerified: false },
    { ...syncSettings, webhookContract: { ...syncSettings.webhookContract, verified: false } },
    { ...syncSettings, readContract: { ...syncSettings.readContract, verified: false } }]) {
    await assert.rejects(runtime({ ...env, BOSTA_SYNC_SETTINGS_JSON: JSON.stringify(settings) }));
  }
});

test("webhook authentication requires an exact configured secret while provider disable retains local authenticated recovery", async () => {
  const value = await runtime({ ...env, BOSTA_ENABLED: "false" });
  assert.ok(value);
  assert.equal(value.canRead, false);
  assert.equal(value.authenticate(env.BOSTA_WEBHOOK_SECRET), true);
  for (const secret of ["", "wrong", ` ${env.BOSTA_WEBHOOK_SECRET}`, `${env.BOSTA_WEBHOOK_SECRET} `]) assert.equal(value.authenticate(secret), false);
  await assert.rejects(value.read("5108002", "reference"), /disabled/i);
});

test("documented webhook types and timestamps produce exact confirmed collection evidence, never a requested amount from an earlier state", async () => {
  const value = (await runtime())!;
  const body = webhookFixture({ trackingNumber: 5108002, timeStamp: 1760000000123 });
  const event = value.parseWebhook(body);
  assert.equal(event.trackingNumber, "5108002");
  assert.equal(event.atMs, 1760000000123);
  assert.equal(event.collectedAmountCents, 13229);
  assert.equal(event.confirmedDelivery, true);
  assert.equal(event.stateCode, 45);
  assert.equal(value.parseWebhook({ ...body, state: 24 }).collectedAmountCents, null);
  for (const invalid of [{ timeStamp: "1760000000123" }, { isConfirmedDelivery: "true" }, { cod: 132.291 },
    { trackingNumber: 1.5 }, { state: "45" }, { timeStamp: Date.now() + 600_000 }]) {
    assert.throws(() => value.parseWebhook({ ...body, ...invalid }));
  }
});

test("verified minor units and second timestamps are converted without rounding or assuming units", async () => {
  const value = (await runtime({ ...env, BOSTA_SYNC_SETTINGS_JSON: JSON.stringify({ ...syncSettings,
    webhookContract: { ...syncSettings.webhookContract, collectionUnit: "minor", timestampUnit: "seconds" } }) }))!;
  const event = value.parseWebhook(webhookFixture({ cod: 13229, timeStamp: 1760000000 }));
  assert.equal(event.atMs, 1760000000000);
  assert.equal(event.collectedAmountCents, 13229);
  assert.throws(() => value.parseWebhook(webhookFixture({ cod: 132.29, timeStamp: 1760000000 })));
});

test("linked shipment reads verify tracking/reference and separate actual collected money from edited requested COD", async () => {
  let reference = "reference";
  const value = (await runtime(env, async (input, init) => {
    assert.equal(String(input), `${env.BOSTA_BASE_URL}/deliveries/business/5108002`);
    assert.equal(init?.method, "GET");
    return Response.json(readFixture(reference));
  }))!;
  const event = await value.read("5108002", "reference");
  assert.equal(event.collectedAmountCents, 13229);
  assert.equal(event.carrier.requestedCodAmountCents, 15000);
  assert.equal(event.carrier.notes, "Carrier notes");
  assert.equal(event.carrier.size, "MEDIUM");
  reference = "unrelated";
  await assert.rejects(value.read("5108002", "reference"), /correlation/i);
});

test("missing collection/proof never fabricates paid evidence and malformed state/time responses are rejected", async () => {
  let changes: Record<string, unknown> = { collection: {} };
  const value = (await runtime(env, async () => Response.json(readFixture("reference", changes))))!;
  const event = await value.read("5108002", "reference");
  assert.equal(event.collectedAmountCents, null);
  assert.equal(event.confirmedDelivery, null);
  for (const invalid of [{ state: {} }, { updatedAt: "not a date" }, { trackingNumber: "another" }, { collection: { amount: 0.001, confirmed: true } }]) {
    changes = invalid;
    await assert.rejects(value.read("5108002", "reference"));
  }
});

test("saved synchronization payloads redact escaped secrets in nested values and keys", async () => {
  const secret = 'fixture"secret\\key';
  const value = (await runtime({ ...env, BOSTA_WEBHOOK_SECRET: secret }, async () =>
    Response.json(readFixture("reference", { echo: { [secret]: [secret] } }))))!;
  const event = await value.read("5108002", "reference");
  assert.deepEqual((event.raw as any).data.echo, { "[redacted]": ["[redacted]"] });
  assert.equal(JSON.stringify(value).includes(secret), false);
});

test("carrier state labels and package size cannot expose credentials through the state display", async () => {
  const secret = 'fixture"secret\\key';
  const value = (await runtime({ ...env, BOSTA_WEBHOOK_SECRET: secret }, async () =>
    Response.json(readFixture("reference", { state: { code: 45, value: secret }, specs: { size: secret } }))))!;
  const event = await value.read("5108002", "reference");
  assert.equal(event.stateName, "[redacted]");
  assert.equal(event.carrier.size, "[redacted]");
});

test("unknown carrier types use a bounded code label instead of untrusted provider text", async () => {
  const value = (await runtime(env, async () => Response.json(readFixture("reference", {
    type: { code: 666, value: "provider credential echo" } }))))!;
  assert.equal((await value.read("5108002", "reference")).type, "UNKNOWN_666");
});
