import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";
import { db } from "@capella/database/src/db";
import { orders } from "@capella/database/drizzle/schema";
import type { PaymentStatus } from "@capella/shared";

beforeEach(async () => {
  await resetApiTestDatabase();
});

type Seed = {
  code: string;
  day?: number;
  name?: string;
  email?: string;
  phone?: string;
  total?: string;
  status?: PaymentStatus;
};

async function seedOrders(seeds: Seed[]) {
  const ids = await getBaselineIds();
  await db.insert(orders).values(seeds.map((seed) => ({
    orderCode: seed.code,
    customerType: "registered" as const,
    customerId: ids.customerId,
    fullName: seed.name ?? "List Customer",
    phone: seed.phone ?? "01000000000",
    email: seed.email ?? "list@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    notes: "",
    paymentMethod: "cod",
    paymentStatus: seed.status ?? "pending",
    totalAmount: seed.total ?? "100.00",
    createdAt: new Date(Date.UTC(2026, 0, seed.day ?? 1, 12))
  })));
}

const codes = (body: { items: Array<{ orderCode: string }> }) => body.items.map((item) => item.orderCode);

test("erp orders list returns one page, newest first, with the matching total", async () => {
  await seedOrders(Array.from({ length: 25 }, (_, index) => ({ code: `LIST-${String(index + 1).padStart(2, "0")}`, day: index + 1 })));

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const first = await request("/api/erp/orders?q=LIST-", { headers });
    assert.equal(first.status, 200);
    assert.equal(first.json.items.length, 20);
    assert.equal(first.json.items[0].orderCode, "LIST-25");
    assert.equal(typeof first.json.items[0].totalAmount, "number");
    assert.deepEqual(first.json.pagination, { page: 1, pageSize: 20, total: 25, totalPages: 2 });

    const second = await request("/api/erp/orders?q=LIST-&page=2", { headers });
    assert.deepEqual(codes(second.json), ["LIST-05", "LIST-04", "LIST-03", "LIST-02", "LIST-01"]);
  });
});

test("erp orders list sorts by a whitelisted column with a stable tie-break", async () => {
  await seedOrders([
    { code: "SORT-B", total: "50.00", day: 1 },
    { code: "SORT-A", total: "300.00", day: 2 },
    { code: "SORT-C", total: "50.00", day: 3 }
  ]);

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    assert.deepEqual(codes((await request("/api/erp/orders?q=SORT-&sort=code", { headers })).json), ["SORT-A", "SORT-B", "SORT-C"]);
    assert.deepEqual(codes((await request("/api/erp/orders?q=SORT-&sort=code&dir=desc", { headers })).json), ["SORT-C", "SORT-B", "SORT-A"]);
    assert.deepEqual(codes((await request("/api/erp/orders?q=SORT-&sort=total", { headers })).json), ["SORT-C", "SORT-B", "SORT-A"]);
  });
});

test("erp orders payment filter matches the shared rule for every payment state", async () => {
  const seeds: Seed[] = [
    { code: "PAY-COD-P", status: "pending" },
    { code: "PAY-COD-A", status: "accepted" },
    { code: "PAY-COD-D", status: "denied" },
  ];
  await seedOrders(seeds);

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    for (const filter of ["pending", "accepted", "denied"] as const) {
      const response = await request(`/api/erp/orders?q=PAY-&payment=${filter}`, { headers });
      const expected = seeds
        .filter((seed) => (seed.status ?? "pending") === filter)
        .map((seed) => seed.code)
        .sort();
      assert.deepEqual(codes(response.json).sort(), expected, filter);
    }
  });
});

test("erp orders list searches code, name, email and phone, with wildcards taken literally", async () => {
  await seedOrders([
    { code: "FIND-1", name: "Nour Hassan" },
    { code: "FIND-2", email: "mona@example.com" },
    { code: "FIND-3", phone: "01155554444" },
    { code: "FIND-4", name: "100% Real" }
  ]);

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const search = async (term: string) => codes((await request(`/api/erp/orders?q=${encodeURIComponent(term)}`, { headers })).json);
    assert.deepEqual(await search("nour"), ["FIND-1"]);
    assert.deepEqual(await search("mona@"), ["FIND-2"]);
    assert.deepEqual(await search("5555"), ["FIND-3"]);
    assert.deepEqual(await search("FIND-2"), ["FIND-2"]);
    assert.deepEqual(await search("100%"), ["FIND-4"]);
  });
});

test("erp orders list filters by a date range", async () => {
  await seedOrders([{ code: "DAY-1", day: 1 }, { code: "DAY-5", day: 5 }, { code: "DAY-9", day: 9 }]);

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const from = encodeURIComponent("2026-01-04T00:00:00.000Z");
    const to = encodeURIComponent("2026-01-06T23:59:59.999Z");
    assert.deepEqual(codes((await request(`/api/erp/orders?q=DAY-&from=${from}&to=${to}`, { headers })).json), ["DAY-5"]);
    assert.deepEqual(codes((await request(`/api/erp/orders?q=DAY-&from=${from}`, { headers })).json), ["DAY-9", "DAY-5"]);
  });
});

test("erp orders list rejects invalid params", async () => {
  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    for (const query of ["sort=fullName", "dir=sideways", "payment=refunded", "from=yesterday", "pageSize=20", "pages=2", "extra=1"]) {
      assert.equal((await request(`/api/erp/orders?${query}`, { headers })).status, 400, query);
    }
  });
});

test("erp order payment summary counts orders by payment outcome, optionally since a date", async () => {
  const seeds: Seed[] = [
    { code: "SUM-1", status: "pending", day: 1 },
    { code: "SUM-2", status: "accepted", day: 5 },
    { code: "SUM-3", status: "accepted", day: 6 },
    { code: "SUM-4", status: "denied", day: 7 },
    { code: "SUM-5", status: "pending", day: 8 }
  ];
  await seedOrders(seeds);

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const all = await request("/api/erp/orders/payment-summary", { headers });
    assert.equal(all.status, 200);
    assert.deepEqual(all.json, { accepted: 2, pending: 2, denied: 1 });

    const since = await request(`/api/erp/orders/payment-summary?since=${encodeURIComponent("2026-01-06T00:00:00.000Z")}`, { headers });
    assert.deepEqual(since.json, { accepted: 1, pending: 1, denied: 1 });

    assert.equal((await request("/api/erp/orders/payment-summary?since=soon", { headers })).status, 400);
  });
});
