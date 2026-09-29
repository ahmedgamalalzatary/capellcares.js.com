import assert from "node:assert/strict";
import test from "node:test";
import { resolveBostaEditRuntime } from "../../src/modules/shipping/bosta/bosta-edit.service.js";
import { BostaProviderError } from "../../src/modules/shipping/bosta/bosta-client.js";
import { syncEnvironment, readFixture } from "../helpers/bosta-sync.js";

const settings = { accountVerified: true, accountEvidence: "controlled fixture only", accountId: "fixture",
  readContract: { verified: true, evidence: "controlled fixture only", editablePath: ["editAvailability", "editable"], prePickupPath: ["editAvailability", "prePickup"] } };
const env = { ...syncEnvironment, BOSTA_EDITS_ENABLED: "true", BOSTA_EDIT_SETTINGS_JSON: JSON.stringify(settings) };

test("merchant edit availability stays gated and refuses absent or mismatched evidence", () => {
  assert.equal(resolveBostaEditRuntime(syncEnvironment), null);
  assert.equal(resolveBostaEditRuntime({ ...env, BOSTA_ENABLED: "false" }), null);
  assert.throws(() => resolveBostaEditRuntime({ ...env, BOSTA_EDIT_SETTINGS_JSON: "{}" }));
  assert.throws(() => resolveBostaEditRuntime({ ...env, BOSTA_EDIT_SETTINGS_JSON: JSON.stringify({ ...settings, accountId: "other-account" }) }), /matching/i);
});

test("edit runtime reads verified booleans and PUT uses the correlated tracking endpoint", async () => {
  const runtime = resolveBostaEditRuntime(env, async (url, init) => {
    assert.equal(String(url), "https://stg-app.bosta.co/api/v2/deliveries/business/5108002");
    if (init?.method === "PUT") {
      assert.deepEqual(JSON.parse(String(init.body)), { notes: "Corrected" });
      return Response.json({ success: true });
    }
    return Response.json(readFixture("ref", { editAvailability: { editable: true, prePickup: true } }));
  })!;
  const read = await runtime.read("5108002", "ref");
  assert.equal(read.editable, true);
  assert.equal(read.prePickup, true);
  await runtime.update("5108002", { notes: "Corrected" });
});

test("malformed availability and an ambiguous PUT never claim edit success", async () => {
  const runtime = resolveBostaEditRuntime(env, async (_url, init) => init?.method === "PUT"
    ? Response.json({ success: false })
    : Response.json(readFixture("ref", { editAvailability: { editable: "true", prePickup: true } })))!;
  await assert.rejects(runtime.read("5108002", "ref"), /boolean/i);
  await assert.rejects(runtime.update("5108002", { notes: "Corrected" }), error => error instanceof BostaProviderError && error.kind === "ambiguous");
});
