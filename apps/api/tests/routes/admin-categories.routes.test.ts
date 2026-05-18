import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { app } from "../../src/app.js";
import { db } from "@capella/database/src/db";
import { categories } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("admin category delete rejects categories that still have linked products", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request(`/api/erp/categories/${ids.rootCategoryId}`, {
      method: "DELETE",
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
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
    const response = await request(`/api/erp/categories/${parent.id}`, {
      method: "DELETE",
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "has-active-children");
  });
});
