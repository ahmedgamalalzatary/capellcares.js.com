import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

function makeItem(input: Partial<Record<string, unknown>> = {}) {
  return {
    imagePath: "/uploads/shop-media.jpg",
    mobileImagePath: "/uploads/shop-media-mobile.jpg",
    targetType: "collections",
    targetId: null,
    sortOrder: 1,
    ...input
  };
}

test("erp shop media sections can be listed and updated, and storefront returns only active populated sections", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const initialResponse = await request("/api/erp/shop-media-sections", {
      headers: { ...authHeaders }
    });

    assert.equal(initialResponse.status, 200);
    assert.deepEqual(
      initialResponse.json.items.map((section: any) => section.slot),
      [1, 2, 3, 4]
    );

    const updateResponse = await request("/api/erp/shop-media-sections/2", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        status: "active",
        items: [
          makeItem({
            imagePath: "http://localhost:4000/uploads/shop-media.jpg",
            mobileImagePath: "http://localhost:4000/uploads/shop-media-mobile.jpg",
            targetType: "collections"
          }),
          makeItem({ imagePath: "/uploads/shop-media-2.jpg", mobileImagePath: "/uploads/shop-media-2-mobile.jpg", targetType: "products", sortOrder: 2 })
        ]
      })
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.json.ok, true);

    const afterUpdate = await request("/api/erp/shop-media-sections", {
      headers: { ...authHeaders }
    });

    const updatedSection = afterUpdate.json.items.find((section: any) => section.slot === 2);
    assert.equal(updatedSection.status, "active");
    assert.equal(updatedSection.items.length, 2);
    assert.equal(updatedSection.items[0].imagePath, "/uploads/shop-media.jpg");
    assert.equal(updatedSection.items[0].mobileImagePath, "/uploads/shop-media-mobile.jpg");
    assert.equal(updatedSection.items[1].targetType, "products");

    const storefrontResponse = await request("/api/v1/shop-media-sections");

    assert.equal(storefrontResponse.status, 200);
    assert.deepEqual(
      storefrontResponse.json.items.map((section: any) => section.slot),
      [2]
    );
  });
});

test("erp shop media sections reject invalid payloads", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const badResponse = await request("/api/erp/shop-media-sections/1", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        status: "active",
        items: [
          makeItem({ imagePath: "", targetType: "collection", targetId: null })
        ]
      })
    });

    assert.equal(badResponse.status, 400);
    assert.equal(badResponse.json.error, "Invalid shop media section payload");
  });
});

test("erp shop media sections accept items with only a desktop image", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const response = await request("/api/erp/shop-media-sections/4", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        status: "active",
        items: [
          makeItem({ mobileImagePath: "" })
        ]
      })
    });

    assert.equal(response.status, 200);

    const afterUpdate = await request("/api/erp/shop-media-sections", {
      headers: { ...authHeaders }
    });
    const updatedSection = afterUpdate.json.items.find((section: any) => section.slot === 4);
    assert.equal(updatedSection.items[0].imagePath, "/uploads/shop-media.jpg");
    assert.equal(updatedSection.items[0].mobileImagePath, null);
  });
});

test("erp shop media sections reject items with no desktop or mobile image", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const badResponse = await request("/api/erp/shop-media-sections/1", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        status: "active",
        items: [
          makeItem({ imagePath: "", mobileImagePath: null })
        ]
      })
    });

    assert.equal(badResponse.status, 400);
    assert.equal(badResponse.json.error, "Invalid shop media section payload");
  });
});
