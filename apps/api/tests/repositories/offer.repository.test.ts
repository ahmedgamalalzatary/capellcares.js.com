import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { categories, offerItems, offers } from "@capella/database/drizzle/schema";
import { upsertOfferRepo } from "../../src/repositories/offer.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("upsertOfferRepo rolls back the offer row when a child item insert fails", async () => {
  const ids = await getBaselineIds();

  const [before] = await db.select().from(offers).where(eq(offers.id, ids.offerId)).limit(1);
  const beforeItems = await db.select().from(offerItems).where(eq(offerItems.offerId, ids.offerId));

  await assert.rejects(
    upsertOfferRepo({
      id: ids.offerId,
      slug: before!.slug,
      arName: "Mutated Name",
      enName: "Mutated Name EN",
      fixedPrice: 999,
      categoryId: ids.rootCategoryId,
      status: "active",
      visibility: "visible",
      // Non-existent variant id violates the FK and must abort the whole upsert.
      items: [{ variantId: 999999999, qty: 1 }]
    })
  );

  const [after] = await db.select().from(offers).where(eq(offers.id, ids.offerId)).limit(1);
  const afterItems = await db.select().from(offerItems).where(eq(offerItems.offerId, ids.offerId));

  assert.equal(after?.arName, before?.arName, "offer name must be unchanged after rollback");
  assert.equal(after?.enName, before?.enName, "offer name must be unchanged after rollback");
  assert.equal(afterItems.length, beforeItems.length, "offer items must be unchanged after rollback");
});

test("upsertOfferRepo rejects a category that stops being a root while the offer is being written", async () => {
  const ids = await getBaselineIds();
  const slug = `race-probe-${Date.now()}`;
  let releaseReparent: () => void = () => {};
  const reparentMayCommit = new Promise<void>((resolve) => {
    releaseReparent = resolve;
  });

  // A separate root to adopt the category under. Reparenting it beneath its own
  // descendant would leave a cycle behind if this test ever died mid-run, and
  // clearTestSeed cannot delete a cycle.
  const [newParent] = await db
    .insert(categories)
    .values({ slug: `race-parent-${Date.now()}`, arName: "أب", enName: "Race Parent", isLeaf: false })
    .$returningId();

  // A concurrent transaction turns the chosen root into a child, but has not
  // committed yet. The offer write must not be able to slip past on a snapshot
  // read taken before that commit.
  const reparent = db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({ parentId: newParent.id })
      .where(eq(categories.id, ids.rootCategoryId));
    await reparentMayCommit;
  });

  const upsert = upsertOfferRepo({
    slug,
    arName: "عرض",
    enName: "Race Probe",
    fixedPrice: 10,
    categoryId: ids.rootCategoryId,
    status: "active",
    visibility: "visible",
    items: [{ variantId: ids.firstVariantId, qty: 1 }]
  });

  // Give the upsert time to reach the category check before the reparent lands.
  await new Promise((resolve) => setTimeout(resolve, 300));
  releaseReparent();
  await reparent;

  try {
    await assert.rejects(upsert, (error: Error & { code?: string }) => error.code === "OFFER_CATEGORY_MUST_BE_ROOT");

    const created = await db.select({ id: offers.id }).from(offers).where(eq(offers.slug, slug));
    assert.equal(created.length, 0, "no offer may be left behind by the rejected write");
  } finally {
    // The reparent above is committed, so it has to be undone here or the rest
    // of the suite inherits a baseline whose root category is no longer a root.
    await db.update(categories).set({ parentId: null }).where(eq(categories.id, ids.rootCategoryId));
    await db.delete(categories).where(eq(categories.id, newParent.id));
  }
});
