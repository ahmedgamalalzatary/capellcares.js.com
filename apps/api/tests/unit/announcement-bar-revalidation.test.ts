import assert from "node:assert/strict";
import test from "node:test";

import { revalidateAnnouncementBar } from "../../src/modules/announcement-bar/announcement-bar.controller.js";

test("announcement mutations expose a warning when storefront revalidation is delayed", async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;

  try {
    const warning = await revalidateAnnouncementBar(async () => {
      throw new Error("storefront unavailable");
    });

    assert.match(warning ?? "", /saved/i);
    assert.match(warning ?? "", /storefront/i);
    assert.match(warning ?? "", /10 seconds/i);
  } finally {
    console.warn = originalWarn;
  }
});

test("announcement mutations omit the warning after successful revalidation", async () => {
  assert.equal(await revalidateAnnouncementBar(async () => undefined), undefined);
});
