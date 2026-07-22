import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { asc, eq } from "drizzle-orm";
import {
  announcementBarSettings,
  announcementItems
} from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";
import { app } from "../../src/app.js";
import { syncPermissionCatalog, updateAdminUserPermissions } from "../../src/services/erp-permissions.service.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

function serialTest(name: string, fn: () => Promise<void>) {
  return test(name, { concurrency: false }, fn);
}

beforeEach(async () => {
  await resetApiTestDatabase();
  await db.delete(announcementItems);
  await db.update(announcementBarSettings).set({ isEnabled: true });
});

serialTest("storefront returns active announcements in configured order", async () => {
  await db.insert(announcementItems).values([
    { arText: "ثاني", enText: "Second", isActive: true, sortOrder: 1 },
    { arText: "مخفي", enText: "Hidden", isActive: false, sortOrder: 0 },
    { arText: "أول", enText: "First", isActive: true, sortOrder: 0 }
  ]);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/announcement-bar");

    assert.equal(response.status, 200);
    assert.equal(response.json.enabled, true);
    assert.deepEqual(response.json.items.map((item: { text: { en: string } }) => item.text.en), ["First", "Second"]);
    assert.ok(response.json.items.every((item: { isActive: boolean }) => item.isActive));
  });
});

serialTest("ERP reads all announcements and updates global visibility", async () => {
  await db.insert(announcementItems).values({
    arText: "غير نشط",
    enText: "Inactive",
    isActive: false,
    sortOrder: 0
  });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const adminResponse = await request("/api/erp/announcement-bar", { headers: authHeaders });
    assert.equal(adminResponse.status, 200);
    assert.equal(adminResponse.json.items.length, 1);
    assert.equal(adminResponse.json.items[0].isActive, false);

    const updateResponse = await request("/api/erp/announcement-bar/settings", {
      method: "PUT",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ enabled: false })
    });
    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.json.enabled, false);

    const storefrontResponse = await request("/api/v1/announcement-bar");
    assert.equal(storefrontResponse.json.enabled, false);
  });
});

serialTest("ERP creates, edits, reorders, and deletes announcements", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const jsonHeaders = { ...authHeaders, "content-type": "application/json" };

    const firstCreate = await request("/api/erp/announcement-bar/items", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ text: { ar: "الأول", en: "First" } })
    });
    const secondCreate = await request("/api/erp/announcement-bar/items", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ text: { ar: "الثاني", en: "Second" } })
    });
    assert.equal(firstCreate.status, 201);
    assert.equal(secondCreate.status, 201);
    assert.deepEqual(
      secondCreate.json.announcementBar.items.map((item: { text: { en: string } }) => item.text.en),
      ["First", "Second"]
    );

    const firstId = firstCreate.json.item.id as number;
    const secondId = secondCreate.json.item.id as number;
    const updateResponse = await request(`/api/erp/announcement-bar/items/${firstId}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ text: { ar: "الأول المعدل", en: "First updated" }, isActive: false })
    });
    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.json.item.text.en, "First updated");
    assert.equal(updateResponse.json.item.isActive, false);
    assert.equal(updateResponse.json.announcementBar.items[0].isActive, false);

    const reorderResponse = await request("/api/erp/announcement-bar/reorder", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ ids: [secondId, firstId] })
    });
    assert.equal(reorderResponse.status, 200);
    assert.deepEqual(
      reorderResponse.json.announcementBar.items.map((item: { id: number }) => item.id),
      [secondId, firstId]
    );

    const rows = await db.select().from(announcementItems).orderBy(asc(announcementItems.sortOrder));
    assert.deepEqual(rows.map((row) => row.id), [secondId, firstId]);

    const deleteResponse = await request(`/api/erp/announcement-bar/items/${secondId}`, {
      method: "DELETE",
      headers: authHeaders
    });
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(deleteResponse.json.announcementBar.items.map((item: { id: number }) => item.id), [firstId]);
  });
});

serialTest("ERP preserves independent fields during concurrent partial announcement updates", async () => {
  const [created] = await db.insert(announcementItems).values({
    arText: "Original Arabic",
    enText: "Original English",
    isActive: true,
    sortOrder: 0
  }).$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const headers = { ...authHeaders, "content-type": "application/json" };

    const [textResponse, statusResponse] = await Promise.all([
      request(`/api/erp/announcement-bar/items/${created.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ text: { ar: "Updated Arabic", en: "Updated English" } })
      }),
      request(`/api/erp/announcement-bar/items/${created.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ isActive: false })
      })
    ]);

    assert.equal(textResponse.status, 200);
    assert.equal(statusResponse.status, 200);
  });

  const [row] = await db.select().from(announcementItems).where(eq(announcementItems.id, created.id)).limit(1);
  assert.equal(row?.enText, "Updated English");
  assert.equal(row?.arText, "Updated Arabic");
  assert.equal(row?.isActive, false);
});

serialTest("ERP assigns unique consecutive positions to concurrent announcement creates", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const headers = { ...authHeaders, "content-type": "application/json" };
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => (
      request("/api/erp/announcement-bar/items", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: { ar: `Arabic ${index}`, en: `English ${index}` } })
      })
    )));

    assert.ok(responses.every((response) => response.status === 201));
  });

  const rows = await db.select().from(announcementItems).orderBy(asc(announcementItems.sortOrder));
  assert.deepEqual(rows.map((row) => row.sortOrder), Array.from({ length: 12 }, (_, index) => index));
});

serialTest("ERP validates announcement text and complete reorder sets", async () => {
  await db.insert(announcementItems).values({ arText: "قائم", enText: "Existing", sortOrder: 0 });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const jsonHeaders = { ...authHeaders, "content-type": "application/json" };

    const blankResponse = await request("/api/erp/announcement-bar/items", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ text: { ar: " ", en: "Valid" } })
    });
    assert.equal(blankResponse.status, 400);

    const incompleteReorder = await request("/api/erp/announcement-bar/reorder", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ ids: [] })
    });
    assert.equal(incompleteReorder.status, 400);
  });
});

serialTest("ERP announcement configuration requires admin authentication", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/announcement-bar");
    assert.equal(response.status, 401);
  });
});

serialTest("read-only announcement staff can view but cannot use any mutation endpoint", async () => {
  await syncPermissionCatalog();
  const [created] = await db.insert(announcementItems).values({
    arText: "Protected Arabic",
    enText: "Protected English",
    sortOrder: 0
  }).$returningId();

  await withTestServer(app, async (request) => {
    const auth = await getStaffAuthHeaders(request);
    await updateAdminUserPermissions(auth.user.email, ["announcement_bar.read"]);
    const authHeaders = { authorization: auth.authorization };
    const jsonHeaders = { ...authHeaders, "content-type": "application/json" };

    const readResponse = await request("/api/erp/announcement-bar", { headers: authHeaders });
    assert.equal(readResponse.status, 200);

    const mutationResponses = await Promise.all([
      request("/api/erp/announcement-bar/settings", {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify({ enabled: false })
      }),
      request("/api/erp/announcement-bar/items", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ text: { ar: "New Arabic", en: "New English" } })
      }),
      request(`/api/erp/announcement-bar/items/${created.id}`, {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify({ isActive: false })
      }),
      request(`/api/erp/announcement-bar/items/${created.id}`, {
        method: "DELETE",
        headers: authHeaders
      }),
      request("/api/erp/announcement-bar/reorder", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ ids: [created.id] })
      })
    ]);

    assert.deepEqual(mutationResponses.map((response) => response.status), [403, 403, 403, 403, 403]);
  });
});

serialTest("announcement update permission allows staff mutations and includes read access", async () => {
  await syncPermissionCatalog();

  await withTestServer(app, async (request) => {
    const auth = await getStaffAuthHeaders(request);
    await updateAdminUserPermissions(auth.user.email, ["announcement_bar.update"]);
    const headers = {
      authorization: auth.authorization,
      "content-type": "application/json"
    };

    const readResponse = await request("/api/erp/announcement-bar", { headers });
    assert.equal(readResponse.status, 200);

    const updateResponse = await request("/api/erp/announcement-bar/settings", {
      method: "PUT",
      headers,
      body: JSON.stringify({ enabled: false })
    });
    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.json.enabled, false);
  });
});
