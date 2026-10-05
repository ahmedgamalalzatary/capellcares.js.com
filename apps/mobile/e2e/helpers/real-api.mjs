import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
process.loadEnvFile(resolve(root, ".env.test"));
process.env.NODE_ENV = "test";
if (!process.env.TEST_DATABASE_URL) throw new Error("A disposable TEST_DATABASE_URL is required");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.CORS_ALLOWED_ORIGINS = "http://localhost:8081";
delete process.env.APP_RELEASE_POLICY_JSON;
const { resetApiTestDatabase } = await import("../../../api/tests/helpers/database.ts");
await resetApiTestDatabase(); // The existing helper rejects non-disposable schemas before deleting data.
const { app } = await import("../../../api/src/app.ts");
const { mysqlPool } = await import("../../../api/node_modules/@capella/database/src/db.ts");
const server = app.listen(0, "127.0.0.1", () => {
  process.send?.({ type: "ready", url: `http://127.0.0.1:${server.address().port}` });
});
process.on("message", async message => {
  if (message?.type !== "stop") return;
  await new Promise(resolve => server.close(resolve));
  await mysqlPool.end();
  process.exit(0);
});
