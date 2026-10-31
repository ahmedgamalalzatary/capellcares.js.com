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

const ageInput = { name: { ar: "٣-٥", en: "3-5" }, imagePath: "/uploads/age.png" };

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

test("age groups can be created, listed, renamed and reordered, and keep their photo", async () => {
  await withTestServer(app, async (request) => {
    const created = await post(request, "/api/erp/age-groups", ageInput);
    assert.equal(created.status, 200);
    const id = created.json.id as number;

    const second = await post(request, "/api/erp/age-groups", { name: { ar: "٦-٨", en: "6-8" }, imagePath: "/uploads/six.png" });
    await post(request, "/api/erp/age-groups/reorder", { ids: [second.json.id, id] });
    await post(request, "/api/erp/age-groups", { ...ageInput, id, name: { ar: "٣-٥", en: "3-5 years" } });

    const headers = await getAdminAuthHeaders(request);
    const list = await request("/api/erp/age-groups", { headers });
    const items = list.json.items.filter((item: { slug: string }) => item.slug !== "test-age");
    assert.deepEqual(items.map((item: { slug: string }) => item.slug), ["6-8", "3-5"]);
    assert.equal(items[1].name.en, "3-5 years");
    assert.equal(items[1].imagePath, "/uploads/age.png");
  });
});

test("an age group needs a photo", async () => {
  await withTestServer(app, async (request) => {
    const response = await post(request, "/api/erp/age-groups", { name: { ar: "٣-٥", en: "3-5" }, imagePath: " " });
    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "image-required");
  });
});

test("duplicate age group names are rejected", async () => {
  await withTestServer(app, async (request) => {
    await post(request, "/api/erp/age-groups", ageInput);
    const duplicate = await post(request, "/api/erp/age-groups", ageInput);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.json.reason, "name-conflict");
  });
});

test("a name is required", async () => {
  await withTestServer(app, async (request) => {
    const noEnglish = await post(request, "/api/erp/age-groups", { name: { ar: "٣-٥", en: " " }, imagePath: "/uploads/age.png" });
    assert.equal(noEnglish.status, 400);
    const noSupplierName = await post(request, "/api/erp/suppliers", { name: " " });
    assert.equal(noSupplierName.status, 400);
  });
});

test("brands and characters no longer exist", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    for (const path of ["/api/erp/brands", "/api/erp/characters"]) {
      assert.equal((await request(path, { headers })).status, 404, path);
    }
    for (const path of ["/api/v1/brands", "/api/v1/characters"]) {
      assert.equal((await request(path)).status, 404, path);
    }
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
    for (const path of ["age-groups", "suppliers"]) {
      const response = await request(`/api/erp/${path}`);
      assert.equal(response.status, 401, path);
    }
  });
});

test("publishing a product needs a supplier, and the age group is optional", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const noSupplier = await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { supplierId: null, status: "active" }));
    assert.equal(noSupplier.status, 400);
    assert.equal(noSupplier.json.reason, "cannot-activate-incomplete-product");

    const draft = await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { status: "inactive" }));
    assert.equal(draft.status, 200);

    const published = await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { supplierId: ids.supplierId, sku: "ATTR-2", name: { ar: "لعبة ٢", en: "Attribute Toy 2" }, status: "active" }));
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
    const response = await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { ageGroupIds: [999999], status: "inactive" }));
    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-product-attributes");
  });
});

test("attributes save on a product, and editing without them keeps them", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const secondAge = await post(request, "/api/erp/age-groups", { name: { ar: "٢-٤", en: "2-4" }, imagePath: "/uploads/two.png" });
    await post(request, "/api/erp/products", productInput(ids.leafCategoryId, {
      supplierId: ids.supplierId,
      ageGroupIds: [ids.ageGroupId, secondAge.json.id],
      status: "inactive"
    }));
    const [row] = await db.select({ id: products.id }).from(products).where(eq(products.sku, "ATTR-PRODUCT"));

    await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { id: row!.id, status: "inactive" }));

    const headers = await getAdminAuthHeaders(request);
    const stored = await request(`/api/erp/products/${row!.id}`, { headers });
    assert.equal(stored.json.supplierId, ids.supplierId);
    assert.deepEqual([...stored.json.ageGroupIds].sort(), [ids.ageGroupId, secondAge.json.id].sort());

  });
});

test("items in use cannot be deleted, unused items can", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    for (const [path, id] of [["suppliers", ids.supplierId], ["age-groups", ids.ageGroupId]] as const) {
      const blocked = await request(`/api/erp/${path}/${id}`, { method: "DELETE", headers });
      assert.equal(blocked.status, 409, path);
      assert.equal(blocked.json.reason, "in-use");
    }

    const unused = await post(request, "/api/erp/age-groups", { name: { ar: "٣-٥", en: "3-5" }, imagePath: "/uploads/age.png" });
    const removed = await request(`/api/erp/age-groups/${unused.json.id}`, { method: "DELETE", headers });
    assert.equal(removed.status, 200);
  });
});

test("the storefront sees the ages but never the supplier", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const list = await request("/api/v1/products");
    const product = list.json.items[0];
    assert.deepEqual(product.ageGroupIds, [ids.ageGroupId]);

    const detail = await request(`/api/v1/products/${product.slug}`);

    for (const payload of [list.json, detail.json]) {
      assert.ok(!JSON.stringify(payload).toLowerCase().includes("supplier"), "supplier leaked");
    }
    assert.equal((await request("/api/v1/suppliers")).status, 404);
  });
});

test("storefront lists mark which items have visible products", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    await post(request, "/api/erp/age-groups", { name: { ar: "فارغ", en: "Empty" }, imagePath: "/uploads/empty.png" });
    const ages = await request("/api/v1/age-groups");
    assert.equal(ages.json.items.find((item: { id: number }) => item.id === ids.ageGroupId).hasProducts, true);
    assert.equal(ages.json.items.find((item: { slug: string }) => item.slug === "empty").hasProducts, false);
  });
});

test("genders can be created with a photo, chosen on a product, and shown to the storefront", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const noPhoto = await post(request, "/api/erp/genders", { name: { ar: "بنات", en: "Girls" } });
    assert.equal(noPhoto.status, 400);
    assert.equal(noPhoto.json.reason, "image-required");

    const girls = await post(request, "/api/erp/genders", { name: { ar: "بنات", en: "Girls" }, imagePath: "/uploads/girls.png" });
    const boys = await post(request, "/api/erp/genders", { name: { ar: "أولاد", en: "Boys" }, imagePath: "/uploads/boys.png" });
    const baby = await post(request, "/api/erp/genders", { name: { ar: "بيبي", en: "Baby" }, imagePath: "/uploads/baby.png" });

    const saved = await post(request, "/api/erp/products", productInput(ids.leafCategoryId, {
      supplierId: ids.supplierId,
      genderIds: [girls.json.id, boys.json.id],
      status: "active"
    }));
    assert.equal(saved.status, 200);

    const list = await request("/api/v1/genders");
    assert.equal(list.status, 200);
    const bySlug = new Map(list.json.items.map((item: { slug: string; hasProducts: boolean; imagePath: string }) => [item.slug, item]));
    assert.equal((bySlug.get("girls") as any).hasProducts, true);
    assert.equal((bySlug.get("girls") as any).imagePath, "/uploads/girls.png");
    assert.equal((bySlug.get("baby") as any).hasProducts, false);

    const products = await request("/api/v1/products");
    const product = products.json.items.find((item: { sku?: string; slug: string; genderIds: number[] }) => item.genderIds.length > 0);
    assert.deepEqual([...product.genderIds].sort(), [girls.json.id, boys.json.id].sort());

    const headers = await getAdminAuthHeaders(request);
    const blocked = await request(`/api/erp/genders/${girls.json.id}`, { method: "DELETE", headers });
    assert.equal(blocked.status, 409);
    const removed = await request(`/api/erp/genders/${baby.json.id}`, { method: "DELETE", headers });
    assert.equal(removed.status, 200);

    const unknown = await post(request, "/api/erp/products", productInput(ids.leafCategoryId, { sku: "ATTR-3", genderIds: [999999], status: "inactive" }));
    assert.equal(unknown.json.reason, "invalid-product-attributes");
  });
});
