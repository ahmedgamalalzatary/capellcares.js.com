import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq, isNull } from "drizzle-orm";

import { app } from "../../src/app.js";
import { db } from "@capella/database/src/db";
import { categories, categoryPaths, entityOrderings } from "@capella/database/drizzle/schema";
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

test("admin category permanent delete removes a soft-deleted category and its closure rows", async () => {
  const slug = `permanent-category-${Date.now()}`;
  const [category] = await db
    .insert(categories)
    .values({ slug, arName: "محذوف نهائي", enName: "Permanent Category", isLeaf: true, deletedAt: new Date() })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/categories/${category.id}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 204);
  });

  const remainingCategories = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, category.id));
  assert.equal(remainingCategories.length, 0);

  const remainingPaths = await db
    .select({ descendantId: categoryPaths.descendantId })
    .from(categoryPaths)
    .where(eq(categoryPaths.descendantId, category.id));
  assert.equal(remainingPaths.length, 0);
});

test("admin category permanent delete returns not-in-trash for active categories", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/categories/${ids.leafCategoryId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 404);
    assert.equal(response.json.reason, "not-in-trash");
  });
});

test("admin category permanent delete rejects categories that still have linked entities", async () => {
  const ids = await getBaselineIds();
  await db.update(categories).set({ deletedAt: new Date() }).where(eq(categories.id, ids.rootCategoryId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/categories/${ids.rootCategoryId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "linked-entities");
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

test("admin category create allows the same slug under different parents", async () => {
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

  assert.equal(herDry?.slug, "dry");
  assert.equal(hisDry?.slug, "dry");
});

test("admin category create rejects the same slug under the same parent", async () => {
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
    assert.equal(duplicate.json.reason, "slug-conflict");
  });
});

test("admin category create rejects duplicate root slugs", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: "body-care",
        name: { ar: "العناية بالجسم 2", en: "Body Care 2" },
        parentId: null,
        isLeaf: false
      })
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "slug-conflict");
  });
});

test("admin category reorder persists root ordering by sort order", async () => {
  const ids = await getBaselineIds();
  const [skinCare] = await db
    .insert(categories)
    .values({
      slug: `skin-care-${Date.now()}`,
      arName: "العناية بالبشرة",
      enName: "Skin Care",
      isLeaf: false
    })
    .$returningId();
  const [hairCare] = await db
    .insert(categories)
    .values({
      slug: `hair-care-${Date.now()}`,
      arName: "العناية بالشعر",
      enName: "Hair Care",
      isLeaf: false
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        parentId: null,
        ids: [hairCare.id, skinCare.id, ids.rootCategoryId]
      })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { ok: true });
  });

  const reorderedRoots = await db
    .select({
      entityId: entityOrderings.entityId,
      rank: entityOrderings.rank
    })
    .from(entityOrderings)
    .where(and(eq(entityOrderings.scopeType, "root"), isNull(entityOrderings.scopeId), eq(entityOrderings.entityType, "category")));

  const rootSortOrderById = new Map(reorderedRoots.map((row) => [row.entityId, row.rank]));
  assert.equal(rootSortOrderById.get(hairCare.id), 1);
  assert.equal(rootSortOrderById.get(skinCare.id), 2);
  assert.equal(rootSortOrderById.get(ids.rootCategoryId), 3);
});

test("admin category reorder persists child ordering within the same parent", async () => {
  const [parent] = await db
    .insert(categories)
    .values({
      slug: `parent-${Date.now()}`,
      arName: "قسم الأب",
      enName: "Parent Category",
      isLeaf: false
    })
    .$returningId();
  const [firstChild] = await db
    .insert(categories)
    .values({
      slug: `first-child-${Date.now()}`,
      arName: "الأول",
      enName: "First Child",
      parentId: parent.id,
      isLeaf: true
    })
    .$returningId();
  const [secondChild] = await db
    .insert(categories)
    .values({
      slug: `second-child-${Date.now()}`,
      arName: "الثاني",
      enName: "Second Child",
      parentId: parent.id,
      isLeaf: true
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        parentId: parent.id,
        ids: [secondChild.id, firstChild.id]
      })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { ok: true });
  });

  const reorderedChildren = await db
    .select({
      entityId: entityOrderings.entityId,
      rank: entityOrderings.rank
    })
    .from(entityOrderings)
    .where(and(eq(entityOrderings.scopeType, "category"), eq(entityOrderings.scopeId, parent.id), eq(entityOrderings.entityType, "category")));

  const childSortOrderById = new Map(reorderedChildren.map((row) => [row.entityId, row.rank]));
  assert.equal(childSortOrderById.get(secondChild.id), 1);
  assert.equal(childSortOrderById.get(firstChild.id), 2);
});

test("admin category list keeps ranked roots before newly created unranked roots", async () => {
  const ids = await getBaselineIds();
  const [rankedOne] = await db
    .insert(categories)
    .values({
      slug: `ranked-one-${Date.now()}`,
      arName: "مرتب أول",
      enName: "Ranked One",
      isLeaf: false
    })
    .$returningId();
  const [rankedTwo] = await db
    .insert(categories)
    .values({
      slug: `ranked-two-${Date.now()}`,
      arName: "مرتب ثان",
      enName: "Ranked Two",
      isLeaf: false
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const reorderResponse = await request("/api/erp/categories/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        parentId: null,
        ids: [rankedTwo.id, rankedOne.id, ids.rootCategoryId]
      })
    });

    assert.equal(reorderResponse.status, 200);
  });

  const [unranked] = await db
    .insert(categories)
    .values({
      slug: `unranked-root-${Date.now()}`,
      arName: "غير مرتب",
      enName: "Unranked Root",
      isLeaf: false
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 200);

    const rootIds = response.json.items
      .filter((item: { parentId: number | null }) => item.parentId === null)
      .map((item: { id: number }) => item.id);

    const rankedTwoIndex = rootIds.indexOf(rankedTwo.id);
    const rankedOneIndex = rootIds.indexOf(rankedOne.id);
    const unrankedIndex = rootIds.indexOf(unranked.id);

    assert.notEqual(rankedTwoIndex, -1);
    assert.notEqual(rankedOneIndex, -1);
    assert.notEqual(unrankedIndex, -1);
    assert.ok(rankedTwoIndex < rankedOneIndex, "rank 1 root should stay before rank 2 root");
    assert.ok(unrankedIndex > rankedOneIndex, "unranked root should appear after ranked roots");
  });
});

test("admin category reorder rejects duplicate ids", async () => {
  const [skinCare] = await db
    .insert(categories)
    .values({
      slug: `skin-care-dup-${Date.now()}`,
      arName: "العناية بالبشرة",
      enName: "Skin Care",
      isLeaf: false
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        parentId: null,
        ids: [skinCare.id, skinCare.id]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-root-order");
  });
});

test("admin category reorder rejects ids from a different parent", async () => {
  const [firstParent] = await db
    .insert(categories)
    .values({
      slug: `first-parent-${Date.now()}`,
      arName: "الأب الأول",
      enName: "First Parent",
      isLeaf: false
    })
    .$returningId();
  const [secondParent] = await db
    .insert(categories)
    .values({
      slug: `second-parent-${Date.now()}`,
      arName: "الأب الثاني",
      enName: "Second Parent",
      isLeaf: false
    })
    .$returningId();
  const [childOne] = await db
    .insert(categories)
    .values({
      slug: `child-one-${Date.now()}`,
      arName: "الأول",
      enName: "Child One",
      parentId: firstParent.id,
      isLeaf: true
    })
    .$returningId();
  const [childTwo] = await db
    .insert(categories)
    .values({
      slug: `child-two-${Date.now()}`,
      arName: "الثاني",
      enName: "Child Two",
      parentId: secondParent.id,
      isLeaf: true
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        parentId: firstParent.id,
        ids: [childOne.id, childTwo.id]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-root-order");
  });
});

test("admin category update rejects setting a category as its own parent", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        id: ids.rootCategoryId,
        slug: "body-care",
        name: { ar: "العناية بالجسم", en: "Body Care" },
        parentId: ids.rootCategoryId,
        isLeaf: false
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-parent");
  });

  const [rootCategory] = await db
    .select({ parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.id, ids.rootCategoryId))
    .limit(1);

  assert.equal(rootCategory?.parentId, null);
});

test("admin category create stores an image for direct children of roots only", async () => {
  const ids = await getBaselineIds();
  const slug = `depth-one-image-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        name: { ar: "صورة فرعية", en: "Subcategory Image" },
        parentId: ids.rootCategoryId,
        isLeaf: true,
        imagePath: "/uploads/subcategory.jpg"
      })
    });

    assert.equal(response.status, 200);
  });

  const [createdCategory] = await db
    .select({ imagePath: categories.imagePath, parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  assert.equal(createdCategory?.parentId, ids.rootCategoryId);
  assert.equal(createdCategory?.imagePath, "/uploads/subcategory.jpg");
});

test("admin category create rejects images for categories deeper than one level below root", async () => {
  const ids = await getBaselineIds();
  const [depthOneParent] = await db
    .insert(categories)
    .values({
      slug: `depth-one-parent-${Date.now()}`,
      arName: "أب فرعي",
      enName: "Depth One Parent",
      parentId: ids.rootCategoryId,
      isLeaf: false
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: `depth-two-image-${Date.now()}`,
        name: { ar: "صورة مرفوضة", en: "Rejected Image" },
        parentId: depthOneParent.id,
        isLeaf: true,
        imagePath: "/uploads/not-allowed.jpg"
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-image-depth");
  });
});
