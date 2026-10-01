import type { Server } from "node:http";

/** Close the pool only after requests and background database users drain. */
export function createShutdown(
  server: Server,
  stopWorkers: Array<() => Promise<void>>,
  closeDatabase: () => Promise<void>
): () => Promise<void> {
  let draining: Promise<void> | undefined;
  return () => draining ??= (async () => {
    const requests = new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await Promise.all([requests, ...stopWorkers.map((stop) => stop())]);
    await closeDatabase();
  })();
}
