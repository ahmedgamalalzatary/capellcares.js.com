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
    enImagePath: "/uploads/layout-media.jpg",
    enMobileImagePath: null,
    targetType: "offers",
    targetId: null,
    sortOrder: 1,
    ...input
  };
}

type Request = Parameters<Parameters<typeof withTestServer>[1]>[0];

async function save(request: Request, headers: Record<string, string>, blocks: unknown) {
  return request("/api/erp/shop-layout", {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ blocks })
  });
}

/** One short label per section, so a whole layout reads as a list. */
function describeBlock(block: any) {
  if (block.type === "category") return `category:${block.categoryId}`;
  if (block.type === "media") return `media:${block.mediaSection.status}:${block.mediaSection.items[0]?.enImagePath ?? "-"}`;
  return block.type;
}

test("a shop that never set its layout gets the built-in sections in today's order", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);

    const erp = await request("/api/erp/shop-layout", { headers });
    assert.equal(erp.status, 200);
    assert.deepEqual(erp.json.items.map(describeBlock), ["category_tiles", "offers", "collections", "bestsellers", "new"]);

    const storefront = await request("/api/v1/shop-layout");
    assert.equal(storefront.status, 200);
    assert.deepEqual(storefront.json.items.map(describeBlock), ["category_tiles", "offers", "collections", "bestsellers", "new"]);
  });
});

test("the ERP saves built-in sections, category sections and picture sections in the chosen order", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const { rootCategoryId, leafCategoryId } = await getBaselineIds();

    const response = await save(request, headers, [
      { type: "media", status: "active", items: [makeItem({ enImagePath: "/uploads/top.jpg" })] },
      { type: "bestsellers" },
      { type: "category", categoryId: leafCategoryId },
      { type: "new" },
      { type: "media", status: "inactive", items: [] },
      { type: "category", categoryId: rootCategoryId },
      { type: "offers" }
    ]);
    assert.equal(response.status, 200);
    assert.deepEqual(response.json.items.map(describeBlock), [
      "media:active:/uploads/top.jpg", "bestsellers", `category:${leafCategoryId}`, "new", "media:inactive:-", `category:${rootCategoryId}`, "offers"
    ]);

    const list = await request("/api/erp/shop-layout", { headers });
    assert.deepEqual(list.json.items.map(describeBlock), response.json.items.map(describeBlock));
  });
});

test("a removed built-in section stays off the page and can be added back", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);

    assert.equal((await save(request, headers, [{ type: "new" }])).status, 200);
    assert.deepEqual((await request("/api/v1/shop-layout")).json.items.map(describeBlock), ["new"]);

    assert.equal((await save(request, headers, [{ type: "collections" }, { type: "new" }])).status, 200);
    assert.deepEqual((await request("/api/v1/shop-layout")).json.items.map(describeBlock), ["collections", "new"]);
  });
});

test("saving again keeps a picture section's id and deletes picture sections that were removed", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const { rootCategoryId } = await getBaselineIds();

    const first = await save(request, headers, [
      { type: "media", status: "active", items: [makeItem()] },
      { type: "media", status: "active", items: [makeItem({ enImagePath: "/uploads/second.jpg" })] }
    ]);
    const [keptId, droppedId] = first.json.items.map((block: any) => block.mediaSection.id);

    const second = await save(request, headers, [
      { type: "category", categoryId: rootCategoryId },
      { type: "media", mediaSectionId: keptId, status: "active", items: [makeItem({ enImagePath: "/uploads/changed.jpg" })] }
    ]);
    assert.equal(second.status, 200);
    assert.equal(second.json.items[1].mediaSection.id, keptId);
    assert.equal(second.json.items[1].mediaSection.items[0].enImagePath, "/uploads/changed.jpg");
    assert.equal((await db.select().from(shopMediaSections).where(eq(shopMediaSections.id, droppedId))).length, 0);
  });
});

test("the ERP refuses an empty page, repeated sections, unknown categories, bad pictures and unknown types", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const { rootCategoryId } = await getBaselineIds();

    const cases: unknown[] = [
      [],
      [{ type: "offers" }, { type: "offers" }],
      [{ type: "category", categoryId: rootCategoryId }, { type: "category", categoryId: rootCategoryId }],
      [{ type: "category", categoryId: 999999 }],
      [{ type: "category" }],
      [{ type: "media", status: "active", items: [makeItem({ enImagePath: "" })] }],
      [{ type: "media", status: "active", items: [makeItem({ targetType: "product", targetId: null })] }],
      [{ type: "media", status: "shown", items: [] }],
      [{ type: "media", mediaSectionId: 999999, status: "active", items: [] }],
      [{ type: "banner" }],
      Array.from({ length: 101 }, () => ({ type: "media", status: "inactive", items: [] })),
      "not a list"
    ];

    for (const blocks of cases) {
      const response = await save(request, headers, blocks);
      assert.equal(response.status, 400, JSON.stringify(blocks).slice(0, 120));
      assert.equal(response.json.error, "Invalid shop layout payload");
    }
  });
});

test("the ERP refuses the same picture section twice", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const first = await save(request, headers, [{ type: "media", status: "active", items: [makeItem()] }]);
    const id = first.json.items[0].mediaSection.id;

    const response = await save(request, headers, [
      { type: "media", mediaSectionId: id, status: "active", items: [makeItem()] },
      { type: "media", mediaSectionId: id, status: "active", items: [makeItem()] }
    ]);
    assert.equal(response.status, 400);
  });
});

test("the shop page leaves out hidden or empty picture sections and categories in the trash", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const { rootCategoryId, leafCategoryId } = await getBaselineIds();

    await save(request, headers, [
      { type: "category", categoryId: rootCategoryId },
      { type: "media", status: "inactive", items: [makeItem()] },
      { type: "media", status: "active", items: [] },
      { type: "category", categoryId: leafCategoryId },
      { type: "offers" },
      { type: "media", status: "active", items: [makeItem({ enImagePath: "/uploads/live.jpg" })] }
    ]);
    await db.update(categories).set({ deletedAt: new Date() }).where(eq(categories.id, leafCategoryId));

    const response = await request("/api/v1/shop-layout");
    assert.equal(response.status, 200);
    assert.deepEqual(response.json.items.map(describeBlock), [`category:${rootCategoryId}`, "offers", "media:active:/uploads/live.jpg"]);

    // The ERP still lists the trashed category, so the admin can see it and pick another.
    const erp = await request("/api/erp/shop-layout", { headers });
    assert.equal(erp.json.items.length, 6);
  });
});

test("the shop layout needs the shop media permission in the ERP", async () => {
  await withTestServer(app, async (request) => {
    const list = await request("/api/erp/shop-layout");
    assert.ok(list.status === 401 || list.status === 403);
    const saveResponse = await save(request, {}, [{ type: "offers" }]);
    assert.ok(saveResponse.status === 401 || saveResponse.status === 403);
  });
});
