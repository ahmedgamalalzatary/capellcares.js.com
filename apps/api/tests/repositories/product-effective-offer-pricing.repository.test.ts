import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { offerItems, offers } from "@capella/database/drizzle/schema";
import { findAdminProductByIdRepo, findVisibleProducts } from "../../src/repositories/product.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

test("product reads use an active single-variant offer price everywhere and expose offerIds", async () => {
  await resetApiTestDatabase();
  const ids = await getBaselineIds();

  const [createdOffer] = await db.insert(offers).values({
    slug: `single-variant-offer-${Date.now()}`,
    arName: "عرض سعر المتغير",
    enName: "Variant Price Offer",
    arDescription: null,
    enDescription: null,
    imagePath: "/uploads/variant-price-offer.png",
    fixedPrice: "22.00",
    status: "active",
    visibility: "visible"
  }).$returningId();

  await db.insert(offerItems).values({
    offerId: createdOffer.id,
    variantId: ids.firstVariantId,
    qty: 1
  });

  const storefrontRows = await findVisibleProducts({ lang: "en" });
  const storefrontProduct = storefrontRows.find((product) => product.id === ids.productOneId);
  assert.ok(storefrontProduct);
  assert.equal(storefrontProduct.variants[0]?.price, 22);
  assert.ok(storefrontProduct.offerIds?.includes(createdOffer.id));

  const adminProduct = await findAdminProductByIdRepo(ids.productOneId);
  assert.ok(adminProduct);
  assert.equal(adminProduct.variants[0]?.price, 22);
  assert.ok(adminProduct.offerIds?.includes(createdOffer.id));

  await db.delete(offerItems).where(eq(offerItems.offerId, createdOffer.id));
  await db.delete(offers).where(eq(offers.id, createdOffer.id));
});

test("inactive single-variant offers do not override product prices or tag products", async () => {
  await resetApiTestDatabase();
  const ids = await getBaselineIds();

  const [createdOffer] = await db.insert(offers).values({
    slug: `inactive-single-variant-offer-${Date.now()}`,
    arName: "عرض غير نشط",
    enName: "Inactive Variant Offer",
    arDescription: null,
    enDescription: null,
    imagePath: "/uploads/inactive-variant-offer.png",
    fixedPrice: "22.00",
    status: "inactive",
    visibility: "visible"
  }).$returningId();

  await db.insert(offerItems).values({
    offerId: createdOffer.id,
    variantId: ids.firstVariantId,
    qty: 1
  });

  const storefrontRows = await findVisibleProducts({ lang: "en" });
  const storefrontProduct = storefrontRows.find((product) => product.id === ids.productOneId);
  assert.ok(storefrontProduct);
  assert.equal(storefrontProduct.variants[0]?.price, 35);
  assert.ok(!storefrontProduct.offerIds?.includes(createdOffer.id));

  await db.delete(offerItems).where(eq(offerItems.offerId, createdOffer.id));
  await db.delete(offers).where(eq(offers.id, createdOffer.id));
});

