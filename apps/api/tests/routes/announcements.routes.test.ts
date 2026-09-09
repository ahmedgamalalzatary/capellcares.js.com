import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("erp can replace announcement messages and storefront returns active localized texts", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const saveResponse = await request("/api/erp/announcements", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          { arText: "شحن مجاني", enText: "Free shipping", status: "active", sortOrder: 1 },
          { arText: "مخفي", enText: "Hidden", status: "inactive", sortOrder: 2 }
        ]
      })
    });

    assert.equal(saveResponse.status, 200);

    const listResponse = await request("/api/erp/announcements", {
      headers: { ...authHeaders }
    });
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.json.items.length, 2);
    assert.equal(listResponse.json.items[0].enText, "Free shipping");
    assert.equal(listResponse.json.items[1].status, "inactive");

    const storefrontEn = await request("/api/v1/announcements", {
      headers: { "x-lang": "en" }
    });
    assert.equal(storefrontEn.status, 200);
    assert.deepEqual(storefrontEn.json.items, ["Free shipping"]);

    const storefrontAr = await request("/api/v1/announcements", {
      headers: { "x-lang": "ar" }
    });
    assert.equal(storefrontAr.status, 200);
    assert.deepEqual(storefrontAr.json.items, ["شحن مجاني"]);
  });
});

test("erp stores any number of quotes in the submitted order", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const items = [1, 2, 3, 4, 5].map((n) => ({
      arText: `عربي ${n}`,
      enText: `Quote ${n}`,
      status: "active",
      sortOrder: n
    }));

    const saveResponse = await request("/api/erp/announcements", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ barStatus: "active", items })
    });
    assert.equal(saveResponse.status, 200);

    const storefrontEn = await request("/api/v1/announcements", {
      headers: { "x-lang": "en" }
    });
    assert.deepEqual(storefrontEn.json.items, ["Quote 1", "Quote 2", "Quote 3", "Quote 4", "Quote 5"]);
  });
});

test("erp can hide the whole announcement bar without changing individual quote status", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const saveResponse = await request("/api/erp/announcements", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        barStatus: "inactive",
        items: [
          { arText: "واحد", enText: "One", status: "active", sortOrder: 1 },
          { arText: "اثنان", enText: "Two", status: "active", sortOrder: 2 }
        ]
      })
    });
    assert.equal(saveResponse.status, 200);

    const listResponse = await request("/api/erp/announcements", {
      headers: { ...authHeaders }
    });
    assert.equal(listResponse.json.barStatus, "inactive");
    assert.equal(listResponse.json.items[0].status, "active");
    assert.equal(listResponse.json.items[1].status, "active");

    const storefront = await request("/api/v1/announcements", {
      headers: { "x-lang": "en" }
    });
    assert.deepEqual(storefront.json.items, []);
  });
});

test("concurrent announcement saves leave storefront texts matching the bar-status snapshot", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const headers = { ...authHeaders, "content-type": "application/json" };

    await Promise.all([
      request("/api/erp/announcements", {
        method: "POST",
        headers,
        body: JSON.stringify({
          barStatus: "inactive",
          items: [{ arText: "مخفي", enText: "Hidden", status: "active", sortOrder: 1 }]
        })
      }),
      request("/api/erp/announcements", {
        method: "POST",
        headers,
        body: JSON.stringify({
          barStatus: "active",
          items: [
            { arText: "ظاهر ١", enText: "Visible 1", status: "active", sortOrder: 1 },
            { arText: "ظاهر ٢", enText: "Visible 2", status: "inactive", sortOrder: 2 }
          ]
        })
      }),
      request("/api/v1/announcements", { headers: { "x-lang": "en" } })
    ]);

    const listResponse = await request("/api/erp/announcements", { headers: { ...authHeaders } });
    const storefront = await request("/api/v1/announcements", { headers: { "x-lang": "en" } });
    const expected = listResponse.json.barStatus === "inactive"
      ? []
      : listResponse.json.items
        .filter((item: { status: string }) => item.status === "active")
        .map((item: { enText: string }) => item.enText);

    assert.deepEqual(storefront.json.items, expected);
  });
});

test("erp rejects announcement items with empty text", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const response = await request("/api/erp/announcements", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ arText: "   ", enText: "Free shipping", status: "active", sortOrder: 1 }]
      })
    });

    assert.equal(response.status, 400);
  });
});
