import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { eq } from "drizzle-orm";
import { offerItems, offers } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("admin offer upsert creates a new offer when the payload has no id", async () => {
  const ids = await getBaselineIds();
  const slug = `route-offer-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const createResponse = await request("/api/erp/offers", {
      method: "POST",
      headers: {
        "x-admin-basic": "admin@capella.eg:admin1234",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug,
        name: { ar: "عرض اختبار", en: "Route Offer Test" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-offer.png",
        price: 199,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 2 }
        ]
      })
    });

    assert.equal(createResponse.status, 200);
    assert.equal(createResponse.json.ok, true);

    const adminOffersResponse = await request("/api/erp/offers", {
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
    });
    assert.equal(adminOffersResponse.status, 200);
    assert.equal(
      adminOffersResponse.json.items.some((offer: any) => offer.slug === slug),
      true
    );

    const storefrontOffersResponse = await request("/api/v1/offers");
    assert.equal(storefrontOffersResponse.status, 200);
    assert.equal(
      storefrontOffersResponse.json.items.some((offer: any) => offer.slug === slug),
      true
    );
  });

  const [createdOffer] = await db
    .select({
      id: offers.id,
      slug: offers.slug,
      arName: offers.arName,
      enName: offers.enName,
      visibility: offers.visibility
    })
    .from(offers)
    .where(eq(offers.slug, slug))
    .limit(1);

  assert.ok(createdOffer, "expected offer row to be inserted");
  assert.equal(createdOffer.arName, "عرض اختبار");
  assert.equal(createdOffer.enName, "Route Offer Test");
  assert.equal(createdOffer.visibility, "visible");

  const createdItems = await db
    .select({
      variantId: offerItems.variantId,
      qty: offerItems.qty
    })
    .from(offerItems)
    .where(eq(offerItems.offerId, createdOffer.id));

  assert.equal(createdItems.length, 2);
  assert.deepEqual(
    createdItems
      .map((item) => ({ variantId: item.variantId, qty: item.qty }))
      .sort((a, b) => a.variantId - b.variantId),
    [
      { variantId: ids.firstVariantId, qty: 1 },
      { variantId: ids.secondVariantId, qty: 2 }
    ].sort((a, b) => a.variantId - b.variantId)
  );

  await db.delete(offerItems).where(eq(offerItems.offerId, createdOffer.id));
  await db.delete(offers).where(eq(offers.id, createdOffer.id));
});

test("admin offers list returns ERP offer shape with bilingual name", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/offers", {
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
    });

    assert.equal(response.status, 200);
    const offer = response.json.items[0];
    assert.equal(typeof offer.name?.ar, "string");
    assert.equal(typeof offer.name?.en, "string");
    assert.equal(typeof offer.description?.ar, "string");
    assert.equal(typeof offer.description?.en, "string");
    assert.equal(typeof offer.price, "number");
    assert.equal(typeof offer.originalTotal, "number");
    assert.ok(Array.isArray(offer.items));
  });
});
