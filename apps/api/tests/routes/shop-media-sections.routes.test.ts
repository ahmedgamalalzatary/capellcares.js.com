import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { products } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";
import { withTestServer } from "../helpers/request.js";

// The pictures of a picture section, saved through the shop layout (where each picture section has its place).
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

type Request = Parameters<Parameters<typeof withTestServer>[1]>[0];

/** Saves a page of one picture section followed by offers, and returns the response. */
async function savePictures(request: Request, headers: Record<string, string>, items: unknown[], status = "active") {
  return request("/api/erp/shop-layout", {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ blocks: [{ type: "media", status, items }, { type: "offers" }] })
  });
}

async function erpPictureSection(request: Request, headers: Record<string, string>) {
  const list = await request("/api/erp/shop-layout", { headers });
  return list.json.items.find((block: any) => block.type === "media").mediaSection;
}

test("a picture section keeps all Arabic and English viewport images, as upload paths", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const response = await savePictures(request, headers, [makeItem({
      arImagePath: "http://localhost:4000/uploads/shop-media-ar.jpg",
      arMobileImagePath: "/uploads/shop-media-ar-mobile.jpg",
      enImagePath: "/uploads/shop-media-en.jpg",
      enMobileImagePath: "http://localhost:4000/uploads/shop-media-en-mobile.jpg"
    })]);
    assert.equal(response.status, 200);

    const item = (await erpPictureSection(request, headers)).items[0];
    assert.deepEqual(
      { ar: item.arImagePath, arMobile: item.arMobileImagePath, en: item.enImagePath, enMobile: item.enMobileImagePath },
      { ar: "/uploads/shop-media-ar.jpg", arMobile: "/uploads/shop-media-ar-mobile.jpg", en: "/uploads/shop-media-en.jpg", enMobile: "/uploads/shop-media-en-mobile.jpg" }
    );
  });
});

test("the storefront picture list holds only active picture sections that have pictures, in page order", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/shop-layout", {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ blocks: [
        { type: "media", status: "active", items: [makeItem({ enImagePath: "/uploads/first.jpg" })] },
        { type: "offers" },
        { type: "media", status: "inactive", items: [makeItem({ enImagePath: "/uploads/hidden.jpg" })] },
        { type: "media", status: "active", items: [] },
        { type: "media", status: "active", items: [
          makeItem({ enImagePath: "/uploads/second.jpg" }),
          makeItem({ enImagePath: "/uploads/third.jpg", targetType: "products", sortOrder: 2 })
        ] }
      ] })
    });
    assert.equal(response.status, 200);

    const storefront = await request("/api/v1/shop-media-sections");
    assert.equal(storefront.status, 200);
    assert.deepEqual(
      storefront.json.items.map((section: any) => section.items.map((item: any) => item.enImagePath)),
      [["/uploads/first.jpg"], ["/uploads/second.jpg", "/uploads/third.jpg"]]
    );
  });
});

test("a picture stops resolving its target once the target is soft deleted, and cannot be saved with it again", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const { productOneId } = await getBaselineIds();

    assert.equal((await savePictures(request, headers, [makeItem({ targetType: "product", targetId: productOneId })])).status, 200);
    const before = await request("/api/v1/shop-media-sections");
    assert.ok(before.json.items[0].items[0].targetSlug, "expected a live product to resolve to a slug");

    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, productOneId));

    // The storefront reads a null slug as "link to the home page" instead of routing shoppers to a product page that no longer exists.
    const after = await request("/api/v1/shop-media-sections");
    assert.equal(after.json.items[0].items[0].targetSlug, null);

    const resave = await savePictures(request, headers, [makeItem({ targetType: "product", targetId: productOneId })]);
    assert.equal(resave.status, 400);
    assert.equal(resave.json.error, "Invalid shop layout payload");
  });
});

test("a picture needs an image and, for a detail link, its target", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    for (const item of [
      makeItem({ enImagePath: "", targetType: "collection", targetId: null }),
      makeItem({ enImagePath: "", enMobileImagePath: null })
    ]) {
      const response = await savePictures(request, headers, [item]);
      assert.equal(response.status, 400);
      assert.equal(response.json.error, "Invalid shop layout payload");
    }
  });
});

test("a picture with only an English desktop image is accepted", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    assert.equal((await savePictures(request, headers, [makeItem({ enMobileImagePath: "" })])).status, 200);

    const item = (await erpPictureSection(request, headers)).items[0];
    assert.equal(item.enImagePath, "/uploads/shop-media.jpg");
    assert.equal(item.enMobileImagePath, null);
  });
});
