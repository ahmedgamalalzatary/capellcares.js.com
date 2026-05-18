import assert from "node:assert/strict";
import test from "node:test";

import { app } from "../../src/app.js";
import { withTestServer } from "../helpers/request.js";

test("categories endpoint returns English names when x-lang is en", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/categories", {
      headers: { "x-lang": "en" }
    });

    assert.equal(response.status, 200);
    const category = response.json.items[0];
    assert.ok(category.name?.en || category.enName, "English name should be present");
  });
});

test("categories endpoint returns Arabic names when x-lang is ar", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/categories", {
      headers: { "x-lang": "ar" }
    });

    assert.equal(response.status, 200);
    const category = response.json.items[0];
    assert.ok(category.name?.ar || category.arName, "Arabic name should be present");
  });
});

test("categories endpoint defaults to Arabic when x-lang is absent", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/categories");

    assert.equal(response.status, 200);
    const category = response.json.items[0];
    assert.ok(category.name?.ar || category.arName, "Arabic name should be the default");
  });
});

test("products endpoint respects x-lang header", async () => {
  await withTestServer(app, async (request) => {
    const englishResponse = await request("/api/v1/products", {
      headers: { "x-lang": "en" }
    });
    const arabicResponse = await request("/api/v1/products", {
      headers: { "x-lang": "ar" }
    });

    assert.equal(englishResponse.status, 200);
    assert.equal(arabicResponse.status, 200);

    const englishProduct = englishResponse.json.items[0];
    const arabicProduct = arabicResponse.json.items[0];

    assert.ok(englishProduct.name?.en, "English product name should be present");
    assert.ok(arabicProduct.name?.ar, "Arabic product name should be present");
  });
});
