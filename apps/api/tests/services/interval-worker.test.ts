import assert from "node:assert/strict";
import test from "node:test";
import { startIntervalWorker } from "../../src/services/interval-worker.js";

test("stopping before the first sweep prevents it from starting", async () => {
  let runs = 0;
  const stop = startIntervalWorker(async () => { runs++; }, 60_000, () => assert.fail("unexpected error"));
  await stop();
  assert.equal(runs, 0);
});

test("stopping a worker waits for active work and prevents another sweep", async () => {
  let release!: () => void;
  let started!: () => void;
  const active = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { started = resolve; });
  let runs = 0;
  const stop = startIntervalWorker(async (isStopped) => {
    runs++;
    started();
    await active;
    assert.equal(isStopped(), true);
  }, 5, () => assert.fail("unexpected worker error"));
  await ready;
  let stopped = false;
  const draining = stop().then(() => { stopped = true; });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(stopped, false);
  assert.equal(runs, 1);
  release();
  await draining;
  await stop();
  assert.equal(stopped, true);
  assert.equal(runs, 1);
});

test("a worker reports sweep failures and can still stop", async () => {
  let reported!: () => void;
  const errorReported = new Promise<void>((resolve) => { reported = resolve; });
  const stop = startIntervalWorker(async () => { throw new Error("sweep failed"); }, 60_000, reported);
  await errorReported;
  await stop();
});
