import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createShutdown } from "../../src/services/shutdown.js";

test("shutdown drains HTTP requests and workers before closing the database, once", async () => {
  let releaseRequest!: () => void;
  let requestStarted!: () => void;
  const ready = new Promise<void>((resolve) => { requestStarted = resolve; });
  const server = createServer((_request, response) => {
    releaseRequest = () => response.end("finished");
    requestStarted();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const response = fetch(`http://127.0.0.1:${port}`, { headers: { connection: "close" } }).then((r) => r.text());
  await ready;
  let releaseWorker!: () => void;
  let databaseClosed = 0;
  const shutdown = createShutdown(server, [() => new Promise<void>((resolve) => { releaseWorker = resolve; })],
    async () => { databaseClosed++; });
  const first = shutdown();
  const second = shutdown();
  assert.equal(server.listening, false);
  assert.equal(databaseClosed, 0);
  releaseRequest();
  assert.equal(await response, "finished");
  assert.equal(databaseClosed, 0);
  releaseWorker();
  await Promise.all([first, second]);
  assert.equal(databaseClosed, 1);
});
