import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { variantDiscounts } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import {
  getStorefrontRelatedCardsRepo,
  setRelatedLinksForSourceRepo
} from "../../src/repositories/related-item.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("getStorefrontRelatedCardsRepo prices a related product at its active discounted price, not the original selling price", async () => {
  const ids = await getBaselineIds();

  // Baseline product one's variant sells for 35.00; apply a 50% active discount -> 17.50.
  await db.insert(variantDiscounts).values({
    variantId: ids.firstVariantId,
    type: "percentage",
    value: "50",
    startsAt: new Date("2000-01-01T00:00:00.000Z"),
    endsAt: new Date("2999-01-01T00:00:00.000Z"),
    status: "active"
  });

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productTwoId }, [
    { type: "product", id: ids.productOneId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productTwoId });
  const productOneCard = cards.find((card) => card.type === "product" && card.id === ids.productOneId);

  assert.equal(productOneCard?.price, 17.5);
});
