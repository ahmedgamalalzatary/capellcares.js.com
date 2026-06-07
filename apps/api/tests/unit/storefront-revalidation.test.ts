import assert from "node:assert/strict";
import test from "node:test";

import { triggerStorefrontRevalidation } from "../../src/modules/admin/storefront-revalidation.js";

test("triggerStorefrontRevalidation posts a universal product payload to the storefront webhook", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];

  const originalFetch = globalThis.fetch;
  const originalNodeEnv = process.env.NODE_ENV;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  process.env.NODE_ENV = "development";

  try {
    await triggerStorefrontRevalidation({
      entity: "product",
      slug: "body-lotion-250",
      categorySlugs: ["hair-care"]
    }, {
      storefrontBaseUrl: "http://localhost:3000",
      secret: "dev-revalidate-secret"
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "http://localhost:3000/api/revalidate");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal((calls[0]?.init?.headers as Record<string, string>)["x-revalidate-secret"], "dev-revalidate-secret");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    entity: "product",
    slug: "body-lotion-250",
    categorySlugs: ["hair-care"]
  });
});

test("triggerStorefrontRevalidation posts a universal offer payload with related product slugs", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];

  const originalFetch = globalThis.fetch;
  const originalNodeEnv = process.env.NODE_ENV;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  process.env.NODE_ENV = "development";

  try {
    await triggerStorefrontRevalidation({
      entity: "offer",
      slug: "summer-bundle",
      relatedProductSlugs: ["body-lotion-250", "argan-mask"]
    }, {
      storefrontBaseUrl: "http://localhost:3000",
      secret: "dev-revalidate-secret"
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    entity: "offer",
    slug: "summer-bundle",
    relatedProductSlugs: ["body-lotion-250", "argan-mask"]
  });
});
