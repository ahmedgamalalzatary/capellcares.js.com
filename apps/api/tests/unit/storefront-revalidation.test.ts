import assert from "node:assert/strict";
import test from "node:test";

import { triggerStorefrontProductRevalidation } from "../../src/modules/admin/storefront-revalidation.js";

test("triggerStorefrontProductRevalidation posts the updated product slug to the storefront webhook", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  try {
    await triggerStorefrontProductRevalidation("body-lotion-250", {
      storefrontBaseUrl: "http://localhost:3000",
      secret: "dev-revalidate-secret"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "http://localhost:3000/api/revalidate");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal((calls[0]?.init?.headers as Record<string, string>)["x-revalidate-secret"], "dev-revalidate-secret");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    entity: "product",
    slug: "body-lotion-250"
  });
});
