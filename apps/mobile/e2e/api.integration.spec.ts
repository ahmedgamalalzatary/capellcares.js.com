import { expect, test } from "@playwright/test";
import { fork, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

let api: ChildProcess;
let apiUrl: string;
test.beforeAll(async () => {
  const apiRequire = createRequire(path.resolve("../api/package.json"));
  api = fork(path.resolve("e2e/helpers/real-api.mjs"), [], {
    cwd: path.resolve("../api"),
    execArgv: ["--import", pathToFileURL(apiRequire.resolve("tsx")).href], stdio: ["ignore", "ignore", "pipe", "ipc"]
  });
  let diagnostics = "";
  api.stderr?.on("data", chunk => { diagnostics = (diagnostics + String(chunk)).slice(-2000); });
  apiUrl = await new Promise<string>((resolve, reject) => {
    api.once("error", reject);
    api.once("exit", code => reject(new Error(`Test API exited (${code}): ${diagnostics}`)));
    api.on("message", message => {
      if (typeof message === "object" && message !== null && "type" in message && message.type === "ready" &&
        "url" in message && typeof message.url === "string") resolve(message.url);
    });
  });
});
test.afterAll(async () => {
  if (!api || api.exitCode !== null) return;
  const stopped = new Promise<void>(resolve => api.once("exit", () => resolve()));
  api.send({ type: "stop" });
  await stopped;
});

test("Chrome renders real database-backed catalog data through the mobile client", async ({ page }, testInfo) => {
  // The preview's fixed build-time API origin is forwarded to this isolated
  // Express server. No catalog responses are mocked or replaced.
  await page.route("http://localhost:4000/**", async route => {
    const upstream = await route.fetch({ url: route.request().url().replace("http://localhost:4000", apiUrl) });
    await route.fulfill({ response: upstream });
  });
  const productResponse = page.waitForResponse("http://localhost:4000/api/v1/products");
  await page.goto("/");
  const products = await productResponse;
  expect(products.status()).toBe(200);
  const data = await products.json();
  expect(data.items.length).toBeGreaterThan(0);
  await expect(page.getByText("منتج تجريبي 1", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("phase3-catalog-ar.png") });
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByText("Baseline Product 1", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("phase3-catalog-en.png") });
});
