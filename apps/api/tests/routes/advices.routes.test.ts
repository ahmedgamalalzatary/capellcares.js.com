import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";

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
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/advices", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify(makeAdvicePayload())
    });

    assert.equal(createResponse.status, 200);
    assert.equal(createResponse.json.ok, true);

    const listResponse = await request("/api/erp/advices", {
      headers: { ...authHeaders }
    });

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.json.items.length, 1);

    const created = listResponse.json.items[0];
    assert.equal(created.title.ar, "نصيحة كابيلا");

    const updateResponse = await request("/api/erp/advices", {
      method: "POST",
      headers: {
        ...authHeaders,
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
      headers: { ...authHeaders }
    });

    const updated = updatedList.json.items[0];
    assert.equal(updated.status, "inactive");
    assert.equal(updated.sortOrder, 5);
  });
});

test("storefront advices only returns active advices sorted by sortOrder", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    await request("/api/erp/advices", {
      method: "POST",
      headers: {
        ...authHeaders,
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
        ...authHeaders,
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
        ...authHeaders,
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
    const authHeaders = await getAdminAuthHeaders(request);
    await request("/api/erp/advices", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify(makeAdvicePayload())
    });

    const listResponse = await request("/api/erp/advices", {
      headers: { ...authHeaders }
    });

    const createdId = listResponse.json.items[0].id;

    const deleteResponse = await request(`/api/erp/advices/${createdId}`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteResponse.json.ok, true);

    const afterDelete = await request("/api/erp/advices", {
      headers: { ...authHeaders }
    });

    assert.equal(afterDelete.json.items.length, 0);
  });
});

test("erp advice toggle-status flips active advice to inactive", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    await request("/api/erp/advices", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify(makeAdvicePayload())
    });

    const listResponse = await request("/api/erp/advices", {
      headers: { ...authHeaders }
    });

    const createdId = listResponse.json.items[0].id;

    const toggleResponse = await request(`/api/erp/advices/${createdId}/toggle-status`, {
      method: "POST",
      headers: { ...authHeaders }
    });

    assert.equal(toggleResponse.status, 200);
    assert.equal(toggleResponse.json.ok, true);

    const afterToggle = await request("/api/erp/advices", {
      headers: { ...authHeaders }
    });

    assert.equal(afterToggle.json.items[0].status, "inactive");
  });
});

test("erp advice routes reject invalid ids and invalid upsert payloads", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const badCreate = await request("/api/erp/advices", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: { ar: "نصيحة" },
        description: { ar: "وصف", en: "Description" },
        sortOrder: "NaN"
      })
    });

    assert.equal(badCreate.status, 400);
    assert.equal(badCreate.json.error, "Invalid advice payload");

    const badDelete = await request("/api/erp/advices/not-a-number", {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(badDelete.status, 400);
    assert.equal(badDelete.json.error, "Invalid id");
  });
});

test("erp advice toggle-status returns 404 when the advice does not exist", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/advices/999999/toggle-status", {
      method: "POST",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 404);
    assert.equal(response.json.error, "Advice not found");
  });
});
