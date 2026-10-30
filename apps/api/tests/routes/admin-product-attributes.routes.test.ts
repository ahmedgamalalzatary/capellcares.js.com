import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { eq } from "drizzle-orm";
import { products } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";

type Request = Parameters<Parameters<typeof withTestServer>[1]>[0];

beforeEach(async () => {
  await resetApiTestDatabase();
});

async function post(request: Request, path: string, body: unknown) {
  const headers = await getAdminAuthHeaders(request);
  return request(path, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

const brandInput = { name: { ar: "ليجو", en: "LEGO" }, imagePath: "/uploads/lego.png" };

function productInput(categoryId: number, extra: Record<string, unknown>) {
  return {
    sku: "ATTR-PRODUCT",
    name: { ar: "لعبة", en: "Attribute Toy" },
    keywords: ["toy"],
    imagePath: "/uploads/toy.png",
    categoryId,
    variants: [{ size: "One", price: 100, stock: 5 }],
    ...extra
  };
}

test("brands can be created, listed, renamed and reordered", async () => {
  await withTestServer(app, async (request) => {
    const created = await post(request, "/api/erp/brands", brandInput);
    assert.equal(created.status, 200);
    const id = created.json.id as number;

    const second = await post(request, "/api/erp/brands", { name: { ar: "باربي", en: "Barbie" } });
    await post(request, "/api/erp/brands/reorder", { ids: [second.json.id, id] });
    await post(request, "/api/erp/brands", { ...brandInput, id, name: { ar: "ليجو", en: "LEGO Toys" } });

    const headers = await getAdminAuthHeaders(request);
    const list = await request("/api/erp/brands", { headers });
    const items = list.json.items.filter((item: { slug: string }) => item.slug !== "test-brand");
    assert.deepEqual(items.map((item: { slug: string }) => item.slug), ["barbie", "lego"]);
    assert.equal(items[1].name.en, "LEGO Toys");
    assert.equal(items[1].imagePath, "/uploads/lego.png");
  });
});

test("duplicate brand names are rejected", async () => {
  await withTestServer(app, async (request) => {
    await post(request, "/api/erp/brands", brandInput);
    const duplicate = await post(request, "/api/erp/brands", brandInput);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.json.reason, "name-conflict");
  });
});

test("a name is required", async () => {
  await withTestServer(app, async (request) => {
    const noEnglish = await post(request, "/api/erp/characters", { name: { ar: "باتمان", en: " " } });
    assert.equal(noEnglish.status, 400);
    const noSupplierName = await post(request, "/api/erp/suppliers", { name: " " });
    assert.equal(noSupplierName.status, 400);
  });
});

test("suppliers hold only a unique name", async () => {
  await withTestServer(app, async (request) => {
    const created = await post(request, "/api/erp/suppliers", { name: "Supplier 1" });
    assert.equal(created.status, 200);
    const duplicate = await post(request, "/api/erp/suppliers", { name: "Supplier 1" });
    assert.equal(duplicate.status, 409);

    const headers = await getAdminAuthHeaders(request);
    const list = await request("/api/erp/suppliers", { headers });
    assert.ok(list.json.items.some((item: { name: string }) => item.name === "Supplier 1"));
  });
});

test("admin lists require a login", async () => {
  await withTestServer(app, async (request) => {
    for (const path of ["brands", "characters", "age-groups", "suppliers"]) {
      const response = await request(`/api/erp/${path}`);
      assert.equal(response.status, 401, path);
    }
  });
});

test("publishing a product requires brand, supplier and at least one age group", async () => {
  const ids = await getBaselineIds();
  const complete = { brandId: ids.brandId, supplierId: ids.supplierId, ageGroupIds: [ids.ageGroupId] };

  await withTestServer(app, async (request) => {
    for (const missing of [{ brandId: null }, { supplierId: null }, { ageGroupIds: [] }]) {
      const response = await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { ...complete, ...missing, status: "active" }));
      assert.equal(response.status, 400);
      assert.equal(response.json.reason, "cannot-activate-incomplete-product");
    }

    const draft = await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { status: "inactive" }));
    assert.equal(draft.status, 200);

    const published = await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { ...complete, sku: "ATTR-2", name: { ar: "لعبة ٢", en: "Attribute Toy 2" }, status: "active" }));
    assert.equal(published.status, 200);
  });
});

test("a draft missing attributes cannot be switched on", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { status: "inactive" }));
    const [row] = await db.select({ id: products.id }).from(products).where(eq(products.sku, "ATTR-PRODUCT"));
    const toggled = await post(request, `/api/erp/products/${row!.id}/toggle-status`, {});
    assert.equal(toggled.status, 400);
    assert.equal(toggled.json.reason, "cannot-activate-incomplete-product");
  });
});

test("unknown attribute ids are rejected", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const response = await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { brandId: 999999, status: "inactive" }));
    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-product-attributes");
  });
});

test("attributes save on a product, and editing without them keeps them", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const character = await post(request, "/api/erp/characters", { name: { ar: "باتمان", en: "Batman" }, imagePath: "/uploads/b.png" });
    const secondAge = await post(request, "/api/erp/age-groups", { name: { ar: "٢-٤", en: "2-4" } });
    await post(request, "/api/erp/products", productInput(ids.leafCategoryId, {
      brandId: ids.brandId,
      supplierId: ids.supplierId,
      ageGroupIds: [ids.ageGroupId, secondAge.json.id],
      characterIds: [character.json.id],
      status: "inactive"
    }));
    const [row] = await db.select({ id: products.id }).from(products).where(eq(products.sku, "ATTR-PRODUCT"));

    await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { id: row!.id, status: "inactive" }));

    const headers = await getAdminAuthHeaders(request);
    const stored = await request(`/api/erp/products/${row!.id}`, { headers });
    assert.equal(stored.json.brandId, ids.brandId);
    assert.equal(stored.json.supplierId, ids.supplierId);
    assert.deepEqual([...stored.json.ageGroupIds].sort(), [ids.ageGroupId, secondAge.json.id].sort());
    assert.deepEqual(stored.json.characterIds, [character.json.id]);

    await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { id: row!.id, characterIds: [], status: "inactive" }));
    const cleared = await request(`/api/erp/products/${row!.id}`, { headers });
    assert.deepEqual(cleared.json.characterIds, []);
  });
});

test("items in use cannot be deleted, unused items can", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    for (const [path, id] of [["brands", ids.brandId], ["suppliers", ids.supplierId], ["age-groups", ids.ageGroupId]] as const) {
      const blocked = await request(`/api/erp/${path}/${id}`, { method: "DELETE", headers });
      assert.equal(blocked.status, 409, path);
      assert.equal(blocked.json.reason, "in-use");
    }

    const unused = await post(request, "/api/erp/characters", { name: { ar: "باتمان", en: "Batman" } });
    const removed = await request(`/api/erp/characters/${unused.json.id}`, { method: "DELETE", headers });
    assert.equal(removed.status, 200);
  });
});

test("the storefront sees brand, ages and characters but never the supplier", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const list = await request("/api/v1/products");
    const product = list.json.items[0];
    assert.equal(product.brandId, ids.brandId);
    assert.deepEqual(product.ageGroupIds, [ids.ageGroupId]);
    assert.deepEqual(product.characterIds, []);

    const detail = await request(`/api/v1/products/${product.slug}`);
    assert.equal(detail.json.brandId, ids.brandId);

    for (const payload of [list.json, detail.json]) {
      assert.ok(!JSON.stringify(payload).toLowerCase().includes("supplier"), "supplier leaked");
    }
    assert.equal((await request("/api/v1/suppliers")).status, 404);
  });
});

test("storefront lists mark which items have visible products", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    await post(request, "/api/erp/brands", { name: { ar: "فارغ", en: "Empty" } });
    const brands = await request("/api/v1/brands");
    const bySlug = new Map(brands.json.items.map((item: { slug: string; hasProducts: boolean }) => [item.slug, item.hasProducts]));
    assert.equal(bySlug.get("test-brand"), true);
    assert.equal(bySlug.get("empty"), false);

    const ages = await request("/api/v1/age-groups");
    assert.equal(ages.json.items.find((item: { id: number }) => item.id === ids.ageGroupId).hasProducts, true);
    assert.equal((await request("/api/v1/characters")).status, 200);
  });
});
