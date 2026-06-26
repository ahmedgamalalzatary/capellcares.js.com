import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { and, eq, sql } from "drizzle-orm";
import { collectionItems, collections, offers, relatedItems } from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";
import {
  listRelatedLinksForSourceRepo,
  setRelatedLinksForSourceRepo
} from "../../src/repositories/related-item.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

async function createOffer(slug: string): Promise<number> {
  const [created] = await db
    .insert(offers)
    .values({
      slug,
      arName: slug,
      enName: slug,
      fixedPrice: sql`10`,
      status: "active",
      visibility: "visible"
    })
    .$returningId();
  return created.id;
}

async function createCollection(slug: string, categoryId: number, variantIds: [number, number]): Promise<number> {
  const [created] = await db
    .insert(collections)
    .values({
      slug,
      arName: slug,
      enName: slug,
      fixedPrice: sql`10`,
      categoryId,
      status: "active",
      visibility: "visible"
    })
    .$returningId();
  await db.insert(collectionItems).values([
    { collectionId: created.id, variantId: variantIds[0], qty: 1 },
    { collectionId: created.id, variantId: variantIds[1], qty: 1 }
  ]);
  return created.id;
}

async function rowsFor(sourceType: "product" | "offer", sourceId: number) {
  return db
    .select({
      sourceType: relatedItems.sourceType,
      sourceId: relatedItems.sourceId,
      targetType: relatedItems.targetType,
      targetId: relatedItems.targetId,
      rank: relatedItems.rank
    })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, sourceType), eq(relatedItems.sourceId, sourceId)));
}

test("setRelatedLinksForSource mirrors a link in both directions with per-source rank", async () => {
  const ids = await getBaselineIds();

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "product", id: ids.productTwoId }
  ]);

  assert.deepEqual(await rowsFor("product", ids.productOneId), [
    { sourceType: "product", sourceId: ids.productOneId, targetType: "product", targetId: ids.productTwoId, rank: 1 }
  ]);
  assert.deepEqual(await rowsFor("product", ids.productTwoId), [
    { sourceType: "product", sourceId: ids.productTwoId, targetType: "product", targetId: ids.productOneId, rank: 1 }
  ]);
});

test("setRelatedLinksForSource rejects a self-reference", async () => {
  const ids = await getBaselineIds();

  await assert.rejects(
    setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
      { type: "product", id: ids.productOneId }
    ])
  );
});

test("setRelatedLinksForSource with an empty list unlinks both directions", async () => {
  const ids = await getBaselineIds();

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "product", id: ids.productTwoId }
  ]);
  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, []);

  assert.deepEqual(await rowsFor("product", ids.productOneId), []);
  assert.deepEqual(await rowsFor("product", ids.productTwoId), []);
});

test("reordering one source does not change the other source's rank (per-source ranking)", async () => {
  const ids = await getBaselineIds();
  const offerId = await createOffer("rel-offer-per-source");

  // P1 -> P2 (both sides rank 1)
  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "product", id: ids.productTwoId }
  ]);
  // From P2's side, put the offer first and P1 second.
  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productTwoId }, [
    { type: "offer", id: offerId },
    { type: "product", id: ids.productOneId }
  ]);

  const p1Rows = await rowsFor("product", ids.productOneId);
  const p2ToP1 = (await rowsFor("product", ids.productTwoId)).find(
    (row) => row.targetType === "product" && row.targetId === ids.productOneId
  );

  // P1's view of P2 is untouched.
  assert.equal(p1Rows.find((row) => row.targetId === ids.productTwoId)?.rank, 1);
  // P2 reordered P1 to rank 2.
  assert.equal(p2ToP1?.rank, 2);
});

test("new links append to the end of the source's list", async () => {
  const ids = await getBaselineIds();
  const offerId = await createOffer("rel-offer-append");

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "product", id: ids.productTwoId }
  ]);
  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "product", id: ids.productTwoId },
    { type: "offer", id: offerId }
  ]);

  const rows = await rowsFor("product", ids.productOneId);
  assert.equal(rows.find((row) => row.targetType === "offer" && row.targetId === offerId)?.rank, 2);
});

test("cross-type product<->offer relations work both ways", async () => {
  const ids = await getBaselineIds();
  const offerId = await createOffer("rel-offer-cross");

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "offer", id: offerId }
  ]);

  assert.deepEqual(await listRelatedLinksForSourceRepo("offer", offerId), [
    { type: "product", id: ids.productOneId }
  ]);
});

test("offer<->offer relations work both ways", async () => {
  const offerA = await createOffer("rel-offer-a");
  const offerB = await createOffer("rel-offer-b");

  await setRelatedLinksForSourceRepo({ type: "offer", id: offerA }, [{ type: "offer", id: offerB }]);

  assert.deepEqual(await listRelatedLinksForSourceRepo("offer", offerA), [{ type: "offer", id: offerB }]);
  assert.deepEqual(await listRelatedLinksForSourceRepo("offer", offerB), [{ type: "offer", id: offerA }]);
});

test("collection<->product relations work both ways", async () => {
  const ids = await getBaselineIds();
  const collectionId = await createCollection("rel-collection-product", ids.leafCategoryId, [
    ids.firstVariantId,
    ids.secondVariantId
  ]);

  await setRelatedLinksForSourceRepo({ type: "collection", id: collectionId }, [
    { type: "product", id: ids.productOneId }
  ]);

  assert.deepEqual(await listRelatedLinksForSourceRepo("collection", collectionId), [
    { type: "product", id: ids.productOneId }
  ]);
  assert.deepEqual(await listRelatedLinksForSourceRepo("product", ids.productOneId), [
    { type: "collection", id: collectionId }
  ]);
});
