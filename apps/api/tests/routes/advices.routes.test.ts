import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

function makeAdvicePayload() {
  return {
    title: { ar: "نصيحة كابيلا", en: "Capella Advice" },
    description: { ar: "اشتركي بخطوات واضحة.", en: "Shop with clear steps." },
    imagePath: "/uploads/advice.jpg",
    videoUrl: "https://www.youtube.com/watch?v=capella",
    status: "active",
    sortOrder: 2
  };
}

test("erp advice CRUD persists and updates advice records", async () => {
  await withTestServer(app, async (request) => {
    const createResponse = await request("/api/erp/advices", {
      method: "POST",
      headers: {
        "x-admin-basic": "admin@capella.eg:admin1234",
        "content-type": "application/json"
      },
      body: JSON.stringify(makeAdvicePayload())
    });

    assert.equal(createResponse.status, 200);
    assert.equal(createResponse.json.ok, true);

    const listResponse = await request("/api/erp/advices", {
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
    });

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.json.items.length, 1);

    const created = listResponse.json.items[0];
    assert.equal(created.title.ar, "نصيحة كابيلا");

    const updateResponse = await request("/api/erp/advices", {
      method: "POST",
      headers: {
        "x-admin-basic": "admin@capella.eg:admin1234",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...makeAdvicePayload(),
        id: created.id,
        status: "inactive",
        sortOrder: 5
      })
    });

    assert.equal(updateResponse.status, 200);

    const updatedList = await request("/api/erp/advices", {
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
    });

    const updated = updatedList.json.items[0];
    assert.equal(updated.status, "inactive");
    assert.equal(updated.sortOrder, 5);
  });
});

test("storefront advices only returns active advices sorted by sortOrder", async () => {
  await withTestServer(app, async (request) => {
    await request("/api/erp/advices", {
      method: "POST",
      headers: {
        "x-admin-basic": "admin@capella.eg:admin1234",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...makeAdvicePayload(),
        title: { ar: "الثانية", en: "Second" },
        sortOrder: 2
      })
    });

    await request("/api/erp/advices", {
      method: "POST",
      headers: {
        "x-admin-basic": "admin@capella.eg:admin1234",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...makeAdvicePayload(),
        title: { ar: "الأولى", en: "First" },
        sortOrder: 1
      })
    });

    await request("/api/erp/advices", {
      method: "POST",
      headers: {
        "x-admin-basic": "admin@capella.eg:admin1234",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...makeAdvicePayload(),
        title: { ar: "مخفية", en: "Hidden" },
        status: "inactive",
        sortOrder: 0
      })
    });

    const response = await request("/api/v1/advices");

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.json.items.map((item: any) => item.title.en),
      ["First", "Second"]
    );
  });
});

test("erp advice delete removes the advice from subsequent listings", async () => {
  await withTestServer(app, async (request) => {
    await request("/api/erp/advices", {
      method: "POST",
      headers: {
        "x-admin-basic": "admin@capella.eg:admin1234",
        "content-type": "application/json"
      },
      body: JSON.stringify(makeAdvicePayload())
    });

    const listResponse = await request("/api/erp/advices", {
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
    });

    const createdId = listResponse.json.items[0].id;

    const deleteResponse = await request(`/api/erp/advices/${createdId}`, {
      method: "DELETE",
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
    });

    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteResponse.json.ok, true);

    const afterDelete = await request("/api/erp/advices", {
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
    });

    assert.equal(afterDelete.json.items.length, 0);
  });
});
