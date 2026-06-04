import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { offerItems, offers } from "@capella/database/drizzle/schema";
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
