import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq, isNull } from "drizzle-orm";

import { app } from "../../src/app.js";
import { rebuildCategoryPaths } from "@minikoshk/database/src/category-paths";
import { db } from "@minikoshk/database/src/db";
import { categories, categoryPaths, products } from "@minikoshk/database/drizzle/schema";
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

test("admin category create materializes closure-table paths for the new node", async () => {
  const [root] = await db
    .insert(categories)
    .values({ slug: `paths-root-${Date.now()}`, arName: "جذر", enName: "Root", isLeaf: false })
    .$returningId();
  const [child] = await db
    .insert(categories)
    .values({ slug: `paths-child-${Date.now()}`, arName: "فرع", enName: "Child", isLeaf: true, parentId: root.id })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: `paths-grandchild-${Date.now()}`,
        name: { ar: "حفيد", en: "Grandchild" },
        parentId: child.id,
        isLeaf: true
      })
    });

    assert.equal(response.status, 200);
  });

  const [grandchild] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.enName, "Grandchild"))
    .limit(1);

  assert.ok(grandchild);

  const paths = await db
    .select({
      ancestorId: categoryPaths.ancestorId,
      descendantId: categoryPaths.descendantId,
      depth: categoryPaths.depth
    })
    .from(categoryPaths)
    .where(eq(categoryPaths.descendantId, grandchild.id));

  assert.deepEqual(
    paths
      .map((row) => ({ ancestorId: row.ancestorId, descendantId: row.descendantId, depth: row.depth }))
      .sort((a, b) => a.depth - b.depth),
    [
      { ancestorId: grandchild.id, descendantId: grandchild.id, depth: 0 },
      { ancestorId: child.id, descendantId: grandchild.id, depth: 1 },
      { ancestorId: root.id, descendantId: grandchild.id, depth: 2 }
    ]
  );
});

test("admin category update rebuilds closure-table paths after reparenting", async () => {
  const [firstRoot] = await db
    .insert(categories)
    .values({ slug: `reparent-root-a-${Date.now()}`, arName: "الأول", enName: "First Root", isLeaf: false })
    .$returningId();
  const [secondRoot] = await db
    .insert(categories)
    .values({ slug: `reparent-root-b-${Date.now()}`, arName: "الثاني", enName: "Second Root", isLeaf: false })
    .$returningId();
  const [child] = await db
    .insert(categories)
    .values({ slug: `reparent-child-${Date.now()}`, arName: "الابن", enName: "Child Node", isLeaf: false, parentId: firstRoot.id })
    .$returningId();
  const [grandchild] = await db
    .insert(categories)
    .values({ slug: `reparent-grandchild-${Date.now()}`, arName: "الحفيد", enName: "Grandchild Node", isLeaf: true, parentId: child.id })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        id: child.id,
        slug: `reparent-child-${Date.now()}`,
        name: { ar: "الابن", en: "Child Node" },
        parentId: secondRoot.id,
        isLeaf: false
      })
    });

    assert.equal(response.status, 200);
  });

  const paths = await db
    .select({
      ancestorId: categoryPaths.ancestorId,
      descendantId: categoryPaths.descendantId,
      depth: categoryPaths.depth
    })
    .from(categoryPaths)
    .where(eq(categoryPaths.descendantId, grandchild.id));

  assert.deepEqual(
    paths
      .map((row) => ({ ancestorId: row.ancestorId, descendantId: row.descendantId, depth: row.depth }))
      .sort((a, b) => a.depth - b.depth),
    [
      { ancestorId: grandchild.id, descendantId: grandchild.id, depth: 0 },
      { ancestorId: child.id, descendantId: grandchild.id, depth: 1 },
      { ancestorId: secondRoot.id, descendantId: grandchild.id, depth: 2 }
    ]
  );
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
      id: categories.id,
      sortOrder: categories.sortOrder
    })
    .from(categories)
    .where(and(isNull(categories.parentId), isNull(categories.deletedAt)));

  const rootSortOrderById = new Map(reorderedRoots.map((row) => [row.id, row.sortOrder]));
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
      id: categories.id,
      sortOrder: categories.sortOrder
    })
    .from(categories)
    .where(eq(categories.parentId, parent.id));

  const childSortOrderById = new Map(reorderedChildren.map((row) => [row.id, row.sortOrder]));
  assert.equal(childSortOrderById.get(secondChild.id), 1);
  assert.equal(childSortOrderById.get(firstChild.id), 2);
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

test("admin category delete rejects a category when a descendant has linked products", async () => {
  const [root] = await db
    .insert(categories)
    .values({ slug: `delete-root-${Date.now()}`, arName: "جذر الحذف", enName: "Delete Root", isLeaf: false })
    .$returningId();
  const [child] = await db
    .insert(categories)
    .values({ slug: `delete-child-${Date.now()}`, arName: "فرع الحذف", enName: "Delete Child", isLeaf: true, parentId: root.id })
    .$returningId();
  await rebuildCategoryPaths();

  const ids = await getBaselineIds();
  await db
    .update(products)
    .set({ categoryId: child.id })
    .where(eq(products.id, ids.productOneId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/categories/${root.id}`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "has-products");
  });
});

test("admin category create allows imagePath for depth-1 categories", async () => {
  const [root] = await db
    .insert(categories)
    .values({ slug: `img-root-${Date.now()}`, arName: "جذر صورة", enName: "Image Root", isLeaf: false })
    .$returningId();
  await rebuildCategoryPaths();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: `img-child-${Date.now()}`,
        name: { ar: "فرع صورة", en: "Image Child" },
        parentId: root.id,
        isLeaf: true,
        imagePath: "/uploads/category-child.png"
      })
    });

    assert.equal(response.status, 200);
  });

  const [created] = await db
    .select({ imagePath: categories.imagePath })
    .from(categories)
    .where(eq(categories.enName, "Image Child"))
    .limit(1);

  assert.equal(created?.imagePath, "/uploads/category-child.png");
});

test("admin category create rejects imagePath for root categories", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: `img-root-disallowed-${Date.now()}`,
        name: { ar: "جذر ممنوع", en: "Root Disallowed" },
        parentId: null,
        isLeaf: true,
        imagePath: "/uploads/category-root.png"
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "category-image-depth-invalid");
  });
});

test("admin category create rejects imagePath for depth-2 categories", async () => {
  const [root] = await db
    .insert(categories)
    .values({ slug: `img-depth2-root-${Date.now()}`, arName: "جذر عمق 2", enName: "Depth2 Root", isLeaf: false })
    .$returningId();
  const [child] = await db
    .insert(categories)
    .values({ slug: `img-depth2-child-${Date.now()}`, arName: "فرع عمق 2", enName: "Depth2 Child", isLeaf: false, parentId: root.id })
    .$returningId();
  await rebuildCategoryPaths();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/categories", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: `img-depth2-grandchild-${Date.now()}`,
        name: { ar: "حفيد صورة", en: "Image Grandchild" },
        parentId: child.id,
        isLeaf: true,
        imagePath: "/uploads/category-grandchild.png"
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "category-image-depth-invalid");
  });
});
