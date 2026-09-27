import assert from "node:assert/strict";
import test from "node:test";
import { readFixture } from "../helpers/bosta-sync.js";
import { cancellationEnvironment } from "../helpers/bosta-cancellation.js";
async function resolve(env: Record<string, string | undefined>, fetchImpl: typeof fetch) {
  const module = await import("../../src/modules/shipping/bosta/bosta-cancellation.service.js").catch(() => null);
  assert.ok(module?.resolveBostaCancellationRuntime, "account-gated cancellation adapter is required");
  return module.resolveBostaCancellationRuntime(env, fetchImpl);
}

test("cancellation gates prohibit provider writes until account restrictions, sync and custody proof are verified", async () => {
  const noCalls: typeof fetch = async () => { throw new Error("Provider call forbidden"); };
  assert.equal(await resolve({ ...cancellationEnvironment, BOSTA_CANCELLATION_ENABLED: "false" }, noCalls), null);
  assert.equal(await resolve({ ...cancellationEnvironment, BOSTA_ENABLED: "false" }, noCalls), null);
  await assert.rejects(resolve({ ...cancellationEnvironment, BOSTA_CANCELLATION_SETTINGS_JSON: "{}" }, noCalls));
  await assert.rejects(resolve({ ...cancellationEnvironment, BOSTA_SYNC_ENABLED: "false" }, noCalls));
});

test("adapter reads correlated cancellation/printing/custody evidence and uses the documented DELETE endpoint", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const runtime = await resolve(cancellationEnvironment, async (input, init) => {
    calls.push({ url: String(input), method: init?.method ?? "GET" });
    if (init?.method === "DELETE") return Response.json({ success: true, data: { _id: "fixture-delivery" } });
    return Response.json(readFixture("reference", { state: { code: 10, value: "Pickup requested" },
      cancelProof: { printed: false, prePickup: true, warehouse: true, allowed: true, cancelled: false } }));
  });
  const proof = await runtime!.read("5108002", "reference");
  assert.equal(proof.printed, false);
  assert.equal(proof.prePickup, true);
  assert.equal(proof.warehouseCustody, true);
  assert.equal(proof.cancelled, false);
  await runtime!.cancel("5108002");
  assert.deepEqual(calls.map(call => call.method), ["GET", "DELETE"]);
  assert.ok(calls[1].url.endsWith("/deliveries/business/5108002/terminate"));
});

test("missing or nonboolean printing/custody/cancellation evidence never authorizes cancellation", async () => {
  const runtime = await resolve(cancellationEnvironment, async () => Response.json(readFixture("reference", { cancelProof: { printed: "false" } })));
  await assert.rejects(runtime!.read("5108002", "reference"), /evidence|boolean/i);
});

test("a successful HTTP response with no successful cancellation acknowledgment is an uncertain write", async () => {
  const runtime = await resolve(cancellationEnvironment, async () => Response.json({ success: false, message: "Rejected" }));
  await assert.rejects(runtime!.cancel("5108002"), /uncertain/i);
});
