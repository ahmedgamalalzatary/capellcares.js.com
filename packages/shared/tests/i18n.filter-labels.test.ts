import test from "node:test";
import assert from "node:assert/strict";
import { en } from "../src/i18n/en.ts";
import { ar } from "../src/i18n/ar.ts";

// On a category page the filter panel's catch-all pill is named after that
// category, so the label has to carry the {name} placeholder in both languages.
test("the scoped category label interpolates the category name", () => {
  assert.equal(en.nav.allCategoryTypes, "All {name} Types");
  assert.equal(ar.nav.allCategoryTypes, "كل أنواع {name}");
});

test("the scoped category label is a template, not a fixed string", () => {
  for (const dict of [en, ar]) {
    assert.ok(
      dict.nav.allCategoryTypes.includes("{name}"),
      "allCategoryTypes must contain the {name} placeholder"
    );
  }
});

// `filters.bytype` heads the category list in the filter panel. It was once
// spelled `beytype` in Arabic only, which rendered the heading blank for every
// Arabic shopper — the key has to stay spelled identically in both dictionaries.
// The drawer backdrop is a button, so it needs a name of its own — and one
// distinct from the close control, or both read as the same thing.
test("the filter drawer backdrop has its own label in both languages", () => {
  for (const dict of [en, ar]) {
    assert.ok(dict.filters.dismissFilters.length > 0);
    assert.notEqual(dict.filters.dismissFilters, dict.filters.closeFilters);
  }
});

test("the by-type filter heading uses the same key in both languages", () => {
  assert.equal(en.filters.bytype, "by type");
  assert.equal(ar.filters.bytype, "حسب النوع");
  assert.ok(!("beytype" in ar.filters), "ar.filters must not carry the legacy 'beytype' key");
});
