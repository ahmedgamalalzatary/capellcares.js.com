import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq } from "drizzle-orm";

import { app } from "../../src/app.js";
import { db } from "@capella/database/src/db";
import { categories } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("admin category delete rejects categories that still have linked products", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/categories/${ids.rootCategoryId}`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "has-products");
  });
});

test("admin category delete rejects categories that still have active children", async () => {
  const [parent] = await db
    .insert(categories)
    .values({ slug: "route-parent-cat", arName: "أصل", enName: "Parent", isLeaf: false })
    .$returningId();
  await db
    .insert(categories)
    .values({ slug: "route-child-cat", arName: "فرع", enName: "Child", isLeaf: true, parentId: parent.id });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/categories/${parent.id}`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "has-active-children");
  });
});

test("admin category create supports deeper nesting and marks the parent as non-leaf", async () => {
  const parentSlug = `route-parent-leaf-${Date.now()}`;
  const childSlug = `route-grandchild-cat-${Date.now()}`;
  const [parent] = await db
    .insert(categories)
    .values({ slug: parentSlug, arName: "فرع أصل", enName: "Leaf Parent", isLeaf: true })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: childSlug,
        name: { ar: "حفيد", en: "Grandchild" },
        parentId: parent.id,
        isLeaf: true
      })
    });

    assert.equal(response.status, 200);

    const [updatedParent] = await db.select().from(categories).where(eq(categories.id, parent.id)).limit(1);
    const [createdChild] = await db.select().from(categories).where(eq(categories.slug, childSlug)).limit(1);

    assert.equal(updatedParent?.isLeaf, false);
    assert.equal(createdChild?.parentId, parent.id);
  });
});

test("admin category create returns a conflict instead of crashing on duplicate slug", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: "body-care",
        name: { ar: "العناية بالجسم", en: "Body Care" },
        parentId: null,
        isLeaf: false
      })
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "slug-conflict");
  });
});

test("admin category create allows the same grandchild name under different parents and generates path-based slugs", async () => {
  const ids = await getBaselineIds();

  const [herSkin] = await db
    .insert(categories)
    .values({
      slug: "her-skin",
      arName: "بشرة لها",
      enName: "Her Skin",
      parentId: ids.rootCategoryId,
      isLeaf: false
    })
    .$returningId();
  const [hisSkin] = await db
    .insert(categories)
    .values({
      slug: "his-skin",
      arName: "بشرة له",
      enName: "His Skin",
      parentId: ids.rootCategoryId,
      isLeaf: false
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const first = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: "dry",
        name: { ar: "جاف", en: "Dry" },
        parentId: herSkin.id,
        isLeaf: true
      })
    });

    const second = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: "dry",
        name: { ar: "جاف", en: "Dry" },
        parentId: hisSkin.id,
        isLeaf: true
      })
    });

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
  });

  const created = await db
    .select({
      id: categories.id,
      parentId: categories.parentId,
      slug: categories.slug,
      arName: categories.arName,
      enName: categories.enName
    })
    .from(categories)
    .where(and(eq(categories.enName, "Dry"), eq(categories.arName, "جاف")));

  assert.equal(created.length, 2);

  const herDry = created.find((row) => row.parentId === herSkin.id);
  const hisDry = created.find((row) => row.parentId === hisSkin.id);

  assert.equal(herDry?.slug, "her-skin-dry");
  assert.equal(hisDry?.slug, "his-skin-dry");
});

test("admin category create rejects the same grandchild name under the same parent", async () => {
  const ids = await getBaselineIds();

  const [herSkin] = await db
    .insert(categories)
    .values({
      slug: "her-skin",
      arName: "بشرة لها",
      enName: "Her Skin",
      parentId: ids.rootCategoryId,
      isLeaf: false
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const first = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: "dry",
        name: { ar: "جاف", en: "Dry" },
        parentId: herSkin.id,
        isLeaf: true
      })
    });
    assert.equal(first.status, 200);

    const duplicate = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: "dry",
        name: { ar: "جاف", en: "Dry" },
        parentId: herSkin.id,
        isLeaf: true
      })
    });

    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.json.reason, "category-name-conflict");
  });
});
