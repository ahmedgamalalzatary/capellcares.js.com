import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { eq } from "drizzle-orm";
import { entityMedia, orderItems, productColors, products, productVariants } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";

function serialTest(name: string, fn: () => Promise<void>) {
  return test(name, { concurrency: false }, fn);
}

beforeEach(async () => {
  await resetApiTestDatabase();
});

type Ids = Awaited<ReturnType<typeof getBaselineIds>>;

/** 2 sizes × 2 colours: 4 variants, 2 prices. Colour -1 has its own gallery, colour -2 is a swatch with names. */
function colouredProduct(ids: Ids, overrides: Record<string, unknown> = {}) {
  return {
    sku: "COLOR-1",
    name: { ar: "كرة", en: "Ball" },
    keywords: ["ball"],
    status: "active",
    categoryId: ids.leafCategoryId,
    supplierId: ids.supplierId,
    media: [{ type: "image", arUrl: null, enUrl: "/uploads/general.jpg" }],
    colors: [
      { id: -1, name: { ar: "أسود", en: "Black" }, hex: "#000000", media: [{ type: "image", arUrl: "/uploads/black-ar.jpg", enUrl: "/uploads/black-en.jpg" }, { type: "video", url: "/uploads/black.mp4" }] },
      { id: -2, name: { ar: "", en: "" }, hex: "#0000FF", media: [] }
    ],
    variants: [
      { size: "S", colorId: -1, price: 100, stock: 3 },
      { size: "S", colorId: -2, price: 100, stock: 0 },
      { size: "M", colorId: -1, price: 150, stock: 5 },
      { size: "M", colorId: -2, price: 150, stock: 2 }
    ],
    ...overrides
  };
}

async function postProduct(request: any, body: unknown) {
  const authHeaders = await getAdminAuthHeaders(request);
  return request("/api/erp/products", {
    method: "POST",
    headers: { ...authHeaders, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function productIdBySku(sku: string) {
  const [row] = await db.select({ id: products.id }).from(products).where(eq(products.sku, sku));
  assert.ok(row, `product ${sku} should exist`);
  return row.id;
}

serialTest("admin product upsert saves colours with their own galleries and links variants to them", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await postProduct(request, colouredProduct(ids));
    assert.equal(response.status, 200, JSON.stringify(response.json));

    const productId = await productIdBySku("COLOR-1");
    const authHeaders = await getAdminAuthHeaders(request);
    const detail = await request(`/api/erp/products/${productId}`, { headers: authHeaders });
    assert.equal(detail.status, 200);

    const colors = detail.json.colors as Array<{ id: number; name: { ar: string; en: string }; hex: string | null; media: unknown[] }>;
    assert.equal(colors.length, 2);
    assert.ok(colors.every((color) => color.id > 0));
    assert.deepEqual(colors[0]!.name, { ar: "أسود", en: "Black" });
    assert.equal(colors[0]!.hex, "#000000");
    assert.equal(colors[0]!.media.length, 2);
    assert.equal(colors[1]!.hex, "#0000ff");
    assert.deepEqual(colors[1]!.media, []);

    // The general gallery stays separate from the colour galleries.
    assert.equal(detail.json.media.length, 1);

    const variants = detail.json.variants as Array<{ size: string; colorId: number; price: number; stock: number }>;
    assert.equal(variants.length, 4);
    assert.deepEqual(
      variants.map((variant) => [variant.size, variant.colorId, variant.price, variant.stock]),
      [["S", colors[0]!.id, 100, 3], ["S", colors[1]!.id, 100, 0], ["M", colors[0]!.id, 150, 5], ["M", colors[1]!.id, 150, 2]]
    );
  });
});

serialTest("storefront product detail carries colours and each variant's colour", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    assert.equal((await postProduct(request, colouredProduct(ids))).status, 200);
    const [row] = await db.select({ slug: products.slug }).from(products).where(eq(products.sku, "COLOR-1"));

    const response = await request(`/api/v1/products/${row!.slug}`, { headers: { "x-lang": "en" } });
    assert.equal(response.status, 200);
    const product = response.json.item ?? response.json;
    assert.equal(product.colors.length, 2);
    assert.equal(product.colors[0].media[0].type, "image");
    assert.match(product.colors[0].media[0].enUrl, /black-en\.jpg$/);
    assert.ok(product.variants.every((variant: { colorId: number }) => product.colors.some((color: { id: number }) => color.id === variant.colorId)));
  });
});

serialTest("admin product upsert keeps colour and variant ids on a re-save and removes a dropped colour", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    assert.equal((await postProduct(request, colouredProduct(ids))).status, 200);
    const productId = await productIdBySku("COLOR-1");
    const authHeaders = await getAdminAuthHeaders(request);
    const before = (await request(`/api/erp/products/${productId}`, { headers: authHeaders })).json;
    const [black, blue] = before.colors;
    const blackVariants = before.variants.filter((variant: { colorId: number }) => variant.colorId === black.id);

    const response = await postProduct(request, colouredProduct(ids, {
      id: productId,
      colors: [{ ...black, media: [] }],
      variants: blackVariants
    }));
    assert.equal(response.status, 200, JSON.stringify(response.json));

    const after = (await request(`/api/erp/products/${productId}`, { headers: authHeaders })).json;
    assert.deepEqual(after.colors.map((color: { id: number }) => color.id), [black.id]);
    assert.deepEqual(
      after.variants.map((variant: { id: number }) => variant.id),
      blackVariants.map((variant: { id: number }) => variant.id)
    );
    const blueRows = await db.select({ id: productColors.id }).from(productColors).where(eq(productColors.id, blue.id));
    assert.equal(blueRows.length, 0);
    const blackMedia = await db.select({ id: entityMedia.id }).from(entityMedia).where(eq(entityMedia.productColorId, black.id));
    assert.equal(blackMedia.length, 0);
  });
});

serialTest("admin product upsert rejects a colour with neither a picked colour nor a name", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const body = colouredProduct(ids, {
      colors: [{ id: -1, name: { ar: " ", en: "" }, hex: null, media: [] }],
      variants: [{ size: "S", colorId: -1, price: 100, stock: 1 }]
    });
    const response = await postProduct(request, body);
    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-product-color");
  });
});

serialTest("admin product upsert rejects a variant pointing at an unknown colour", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await postProduct(request, colouredProduct(ids, {
      variants: [{ size: "S", colorId: -9, price: 100, stock: 1 }]
    }));
    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-variant-color");
  });
});

serialTest("admin product upsert rejects two variants with the same size and colour", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await postProduct(request, colouredProduct(ids, {
      variants: [
        { size: "S", colorId: -1, price: 100, stock: 1 },
        { size: " S ", colorId: -1, price: 100, stock: 2 }
      ]
    }));
    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "duplicate-product-variant");
  });
});

serialTest("a product with no sizes, colours or brand can be published", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await postProduct(request, {
      sku: "PLAIN-1",
      name: { ar: "لعبة", en: "Toy" },
      keywords: ["toy"],
      status: "active",
      categoryId: ids.leafCategoryId,
      supplierId: ids.supplierId,
      brandId: null,
      genderIds: [],
      imagePath: "/uploads/toy.jpg",
      variants: [{ size: "", price: 80, stock: 4 }]
    });
    assert.equal(response.status, 200, JSON.stringify(response.json));
    const productId = await productIdBySku("PLAIN-1");
    const rows = await db.select({ size: productVariants.sizeLabel, colorId: productVariants.colorId }).from(productVariants).where(eq(productVariants.productId, productId));
    assert.deepEqual(rows, [{ size: "", colorId: null }]);
  });
});

serialTest("a product whose only pictures sit in a colour gallery can be published and uses that picture as its card image", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await postProduct(request, colouredProduct(ids, { media: [] }));
    assert.equal(response.status, 200, JSON.stringify(response.json));
    const [row] = await db.select({ imagePath: products.imagePath }).from(products).where(eq(products.sku, "COLOR-1"));
    assert.equal(row!.imagePath, "/uploads/black-en.jpg");
  });
});

serialTest("an order line remembers the colour of the variant bought, and a swatch-only colour by its picked colour", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    assert.equal((await postProduct(request, colouredProduct(ids))).status, 200);
    const productId = await productIdBySku("COLOR-1");
    const authHeaders = await getAdminAuthHeaders(request);
    const detail = (await request(`/api/erp/products/${productId}`, { headers: authHeaders })).json;
    const [black, blue] = detail.colors;
    const blackS = detail.variants.find((variant: { size: string; colorId: number }) => variant.size === "S" && variant.colorId === black.id);
    const blueM = detail.variants.find((variant: { size: string; colorId: number }) => variant.size === "M" && variant.colorId === blue.id);

    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        fullName: "Colour Buyer",
        phone: "01012345678",
        email: "colour-buyer@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        items: [{ type: "product", variantId: blackS.id, qty: 1 }, { type: "product", variantId: blueM.id, qty: 1 }]
      })
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));

    const lines = await db
      .select({ variantId: orderItems.variantId, size: orderItems.snapshotSizeLabel, ar: orderItems.snapshotColorAr, en: orderItems.snapshotColorEn })
      .from(orderItems)
      .where(eq(orderItems.orderId, Number(response.json.id)));
    const byVariant = new Map(lines.map((line) => [line.variantId, line]));
    assert.deepEqual(byVariant.get(blackS.id), { variantId: blackS.id, size: "S", ar: "أسود", en: "Black" });
    assert.deepEqual(byVariant.get(blueM.id), { variantId: blueM.id, size: "M", ar: "#0000ff", en: "#0000ff" });
  });
});

serialTest("a product whose pictures all sit in colour galleries reports an empty general gallery", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    assert.equal((await postProduct(request, colouredProduct(ids, { media: [] }))).status, 200);
    const productId = await productIdBySku("COLOR-1");
    const authHeaders = await getAdminAuthHeaders(request);
    const detail = (await request(`/api/erp/products/${productId}`, { headers: authHeaders })).json;
    assert.deepEqual(detail.media, []);
    assert.match(detail.imagePath, /black-en\.jpg$/);
  });
});
