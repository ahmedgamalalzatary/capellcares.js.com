import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { products } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

function makeItem(input: Partial<Record<string, unknown>> = {}) {
  return {
    arImagePath: null,
    arMobileImagePath: null,
    enImagePath: "/uploads/shop-media.jpg",
    enMobileImagePath: "/uploads/shop-media-mobile.jpg",
    targetType: "collections",
    targetId: null,
    sortOrder: 1,
    ...input
  };
}

test("erp shop media sections persist all Arabic and English viewport images", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const localizedImages = {
      arImagePath: "http://localhost:4000/uploads/shop-media-ar.jpg",
      arMobileImagePath: "/uploads/shop-media-ar-mobile.jpg",
      enImagePath: "/uploads/shop-media-en.jpg",
      enMobileImagePath: "http://localhost:4000/uploads/shop-media-en-mobile.jpg"
    };

    const response = await request("/api/erp/shop-media-sections/1", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        status: "active",
        items: [makeItem(localizedImages)]
      })
    });

    assert.equal(response.status, 200);

    const afterUpdate = await request("/api/erp/shop-media-sections", {
      headers: { ...authHeaders }
    });
    const item = afterUpdate.json.items.find((section: any) => section.slot === 1).items[0];
    assert.deepEqual(
      {
        arImagePath: item.arImagePath,
        arMobileImagePath: item.arMobileImagePath,
        enImagePath: item.enImagePath,
        enMobileImagePath: item.enMobileImagePath
      },
      {
        arImagePath: "/uploads/shop-media-ar.jpg",
        arMobileImagePath: "/uploads/shop-media-ar-mobile.jpg",
        enImagePath: "/uploads/shop-media-en.jpg",
        enMobileImagePath: "/uploads/shop-media-en-mobile.jpg"
      }
    );
  });
});

test("erp shop media sections can be listed and updated, and storefront returns only active populated sections", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const initialResponse = await request("/api/erp/shop-media-sections", {
      headers: { ...authHeaders }
    });

    assert.equal(initialResponse.status, 200);
    assert.deepEqual(
      initialResponse.json.items.map((section: any) => section.slot),
      [1, 2, 3, 4, 5]
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
            enImagePath: "http://localhost:4000/uploads/shop-media.jpg",
            enMobileImagePath: "http://localhost:4000/uploads/shop-media-mobile.jpg",
            targetType: "collections"
          }),
          makeItem({ enImagePath: "/uploads/shop-media-2.jpg", enMobileImagePath: "/uploads/shop-media-2-mobile.jpg", targetType: "products", sortOrder: 2 })
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
    assert.equal(updatedSection.items[0].enImagePath, "/uploads/shop-media.jpg");
    assert.equal(updatedSection.items[0].enMobileImagePath, "/uploads/shop-media-mobile.jpg");
    assert.equal(updatedSection.items[1].targetType, "products");

    const storefrontResponse = await request("/api/v1/shop-media-sections");

    assert.equal(storefrontResponse.status, 200);
    assert.deepEqual(
      storefrontResponse.json.items.map((section: any) => section.slot),
      [2]
    );
  });
});

test("shop media stops resolving a target once it is soft deleted", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const { productOneId } = await getBaselineIds();

    const saveResponse = await request("/api/erp/shop-media-sections/3", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        status: "active",
        items: [makeItem({ targetType: "product", targetId: productOneId })]
      })
    });
    assert.equal(saveResponse.status, 200);

    const beforeDelete = await request("/api/v1/shop-media-sections");
    const sectionBefore = beforeDelete.json.items.find((section: any) => section.slot === 3);
    assert.ok(sectionBefore.items[0].targetSlug, "expected a live product to resolve to a slug");

    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, productOneId));

    // The storefront reads a null slug as "link to the home page" instead of routing
    // shoppers to a product page that no longer exists.
    const afterDelete = await request("/api/v1/shop-media-sections");
    const sectionAfter = afterDelete.json.items.find((section: any) => section.slot === 3);
    assert.equal(sectionAfter.items[0].targetSlug, null);

    const resaveResponse = await request("/api/erp/shop-media-sections/3", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        status: "active",
        items: [makeItem({ targetType: "product", targetId: productOneId })]
      })
    });
    assert.equal(resaveResponse.status, 400);
    assert.equal(resaveResponse.json.error, "Invalid shop media section payload");
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
          makeItem({ enImagePath: "", targetType: "collection", targetId: null })
        ]
      })
    });

    assert.equal(badResponse.status, 400);
    assert.equal(badResponse.json.error, "Invalid shop media section payload");
  });
});

test("erp shop media sections accept items with only an English desktop image", async () => {
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
          makeItem({ enMobileImagePath: "" })
        ]
      })
    });

    assert.equal(response.status, 200);

    const afterUpdate = await request("/api/erp/shop-media-sections", {
      headers: { ...authHeaders }
    });
    const updatedSection = afterUpdate.json.items.find((section: any) => section.slot === 4);
    assert.equal(updatedSection.items[0].enImagePath, "/uploads/shop-media.jpg");
    assert.equal(updatedSection.items[0].enMobileImagePath, null);
  });
});

test("erp shop media sections accept updating slot 5", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const response = await request("/api/erp/shop-media-sections/5", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        status: "active",
        items: [
          makeItem({ targetType: "offers" })
        ]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    const afterUpdate = await request("/api/erp/shop-media-sections", {
      headers: { ...authHeaders }
    });
    const updatedSection = afterUpdate.json.items.find((section: any) => section.slot === 5);
    assert.equal(updatedSection.status, "active");
    assert.equal(updatedSection.items.length, 1);
    assert.equal(updatedSection.items[0].targetType, "offers");
  });
});

test("erp shop media sections reject items with no localized image", async () => {
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
          makeItem({ enImagePath: "", enMobileImagePath: null })
        ]
      })
    });

    assert.equal(badResponse.status, 400);
    assert.equal(badResponse.json.error, "Invalid shop media section payload");
  });
});
