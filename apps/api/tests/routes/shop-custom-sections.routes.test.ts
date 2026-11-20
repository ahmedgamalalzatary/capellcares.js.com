import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { categories, shopMediaSections } from "@capella/database/drizzle/schema";
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
    enImagePath: "/uploads/custom-media.jpg",
    enMobileImagePath: null,
    targetType: "offers",
    targetId: null,
    sortOrder: 1,
    ...input
  };
}

type Request = Parameters<Parameters<typeof withTestServer>[1]>[0];

async function save(request: Request, headers: Record<string, string>, blocks: unknown) {
  return request("/api/erp/shop-custom-sections", {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ blocks })
  });
}

test("erp custom sections save categories and picture sections in the chosen order", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const { rootCategoryId, leafCategoryId } = await getBaselineIds();

    const response = await save(request, headers, [
      { type: "category", categoryId: rootCategoryId },
      { type: "category", categoryId: leafCategoryId },
      { type: "media", status: "active", items: [makeItem()] },
      { type: "media", status: "inactive", items: [] }
    ]);
    assert.equal(response.status, 200);

    const list = await request("/api/erp/shop-custom-sections", { headers });
    assert.equal(list.status, 200);
    assert.deepEqual(
      list.json.items.map((block: any) => block.type === "category" ? `category:${block.categoryId}` : `media:${block.mediaSection.status}`),
      [`category:${rootCategoryId}`, `category:${leafCategoryId}`, "media:active", "media:inactive"]
    );
    const media = list.json.items[2].mediaSection;
    assert.equal(media.slot, null);
    assert.equal(media.items[0].enImagePath, "/uploads/custom-media.jpg");
  });
});

test("erp custom sections keep a picture section's id when it is saved again, and drop removed ones", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const { rootCategoryId } = await getBaselineIds();

    await save(request, headers, [
      { type: "media", status: "active", items: [makeItem()] },
      { type: "media", status: "active", items: [makeItem({ enImagePath: "/uploads/second.jpg" })] }
    ]);
    const first = await request("/api/erp/shop-custom-sections", { headers });
    const [keptId, droppedId] = first.json.items.map((block: any) => block.mediaSection.id);

    const response = await save(request, headers, [
      { type: "category", categoryId: rootCategoryId },
      { type: "media", mediaSectionId: keptId, status: "active", items: [makeItem({ enImagePath: "/uploads/changed.jpg" })] }
    ]);
    assert.equal(response.status, 200);

    const second = await request("/api/erp/shop-custom-sections", { headers });
    assert.equal(second.json.items.length, 2);
    assert.equal(second.json.items[1].mediaSection.id, keptId);
    assert.equal(second.json.items[1].mediaSection.items[0].enImagePath, "/uploads/changed.jpg");
    const dropped = await db.select().from(shopMediaSections).where(eq(shopMediaSections.id, droppedId));
    assert.equal(dropped.length, 0);
  });
});

test("erp custom sections refuse the same category twice, an unknown category, and a bad picture", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const { rootCategoryId } = await getBaselineIds();

    const cases = [
      [{ type: "category", categoryId: rootCategoryId }, { type: "category", categoryId: rootCategoryId }],
      [{ type: "category", categoryId: 999999 }],
      [{ type: "media", status: "active", items: [makeItem({ enImagePath: "" })] }],
      [{ type: "media", status: "active", items: [makeItem({ targetType: "product", targetId: null })] }],
      [{ type: "banner" }],
      "not a list"
    ];

    for (const blocks of cases) {
      const response = await save(request, headers, blocks);
      assert.equal(response.status, 400, JSON.stringify(blocks));
      assert.equal(response.json.error, "Invalid shop custom sections payload");
    }
  });
});

test("erp custom sections refuse the top banner or another section's picture id", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    await request("/api/erp/shop-media-sections", { headers });
    const [topBanner] = await db.select({ id: shopMediaSections.id }).from(shopMediaSections).where(eq(shopMediaSections.slot, 1));

    const response = await save(request, headers, [
      { type: "media", mediaSectionId: topBanner.id, status: "active", items: [makeItem()] }
    ]);
    assert.equal(response.status, 400);
  });
});

test("storefront custom sections leave out hidden pictures and deleted categories", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const { rootCategoryId, leafCategoryId } = await getBaselineIds();

    await save(request, headers, [
      { type: "category", categoryId: rootCategoryId },
      { type: "media", status: "inactive", items: [makeItem()] },
      { type: "media", status: "active", items: [] },
      { type: "category", categoryId: leafCategoryId },
      { type: "media", status: "active", items: [makeItem({ enImagePath: "/uploads/live.jpg" })] }
    ]);
    await db.update(categories).set({ deletedAt: new Date() }).where(eq(categories.id, leafCategoryId));

    const response = await request("/api/v1/shop-custom-sections");
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.json.items.map((block: any) => block.type === "category" ? block.categoryId : block.mediaSection.items[0].enImagePath),
      [rootCategoryId, "/uploads/live.jpg"]
    );
  });
});

test("erp custom sections need shop media permission", async () => {
  await withTestServer(app, async (request) => {
    const list = await request("/api/erp/shop-custom-sections");
    assert.ok(list.status === 401 || list.status === 403);
    const saveResponse = await save(request, {}, []);
    assert.ok(saveResponse.status === 401 || saveResponse.status === 403);
  });
});
