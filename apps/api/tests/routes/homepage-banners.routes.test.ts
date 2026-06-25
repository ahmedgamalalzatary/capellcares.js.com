import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { homepageBannerItems } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";

function serialTest(name: string, fn: () => Promise<void>) {
  return test(name, { concurrency: false }, fn);
}

beforeEach(async () => {
  await resetApiTestDatabase();
});

serialTest("admin homepage banners upsert enforces single-image sections and storefront returns normalized sections", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/homepage-banners/sections/single_mid/items", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        imagePath: "/uploads/home-single-1.png",
        href: "/products/test-product-baseline-1"
      })
    });

    assert.equal(createResponse.status, 200);
    assert.equal(createResponse.json.ok, true);

    const secondCreateResponse = await request("/api/erp/homepage-banners/sections/single_mid/items", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        imagePath: "/uploads/home-single-2.png",
        href: "/products/test-product-baseline-2"
      })
    });

    assert.equal(secondCreateResponse.status, 409);
    assert.equal(secondCreateResponse.json.reason, "single-section-limit");

    const gridCreateResponses = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        request("/api/erp/homepage-banners/sections/grid_featured/items", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            imagePath: `/uploads/grid-${index + 1}.png`,
            href: `/offers/test-offer-${index + 1}`
          })
        })
      )
    );

    gridCreateResponses.forEach((response) => {
      assert.equal(response.status, 200);
      assert.equal(response.json.ok, true);
    });

    const adminResponse = await request("/api/erp/homepage-banners", {
      headers: { ...authHeaders }
    });

    assert.equal(adminResponse.status, 200);
    assert.equal(adminResponse.json.sections.single_mid.items.length, 1);
    assert.equal(adminResponse.json.sections.grid_featured.items.length, 5);

    const storefrontResponse = await request("/api/v1/homepage-banners");
    assert.equal(storefrontResponse.status, 200);
    assert.equal(storefrontResponse.json.sections.hero_primary.items.length, 0);
    assert.equal(storefrontResponse.json.sections.grid_featured.behavior, "manual-grid");
    assert.equal(storefrontResponse.json.sections.grid_featured.items.length, 5);
    assert.equal(storefrontResponse.json.sections.single_mid.items.length, 1);
  });

  const singleMidRows = await db
    .select({
      id: homepageBannerItems.id,
      imagePath: homepageBannerItems.imagePath,
      href: homepageBannerItems.href
    })
    .from(homepageBannerItems)
    .where(eq(homepageBannerItems.sectionKey, "single_mid"));

  assert.equal(singleMidRows.length, 1);
  assert.equal(singleMidRows[0]?.imagePath, "/uploads/home-single-1.png");
  assert.equal(singleMidRows[0]?.href, "/products/test-product-baseline-1");
});
