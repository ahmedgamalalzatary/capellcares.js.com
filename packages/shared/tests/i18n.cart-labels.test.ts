import test from "node:test";
import assert from "node:assert/strict";
import { en } from "../src/i18n/en.ts";
import { ar } from "../src/i18n/ar.ts";

// Every control that puts something in the cart says "add to cart" — never the
// bare noun "cart", and never a per-entity variant ("add the bundle to cart").
test("every add-to-cart label reads 'add to cart' in English", () => {
  assert.equal(en.common.addToCart, "Add to cart");
  assert.equal(en.offers.addBundleToCart, "Add to cart");
  assert.equal(en.collections.addCollectionToCart, "Add to cart");
});

test("every add-to-cart label reads 'add to cart' in Arabic", () => {
  assert.equal(ar.common.addToCart, "أضف إلى السلة");
  assert.equal(ar.offers.addBundleToCart, "أضف إلى السلة");
  assert.equal(ar.collections.addCollectionToCart, "أضف إلى السلة");
});

// The header's cart icon links to the cart page; it is a destination, not an
// add action, so it keeps the noun.
test("the cart nav destination keeps the plain 'cart' noun", () => {
  assert.equal(en.nav.cart, "Cart");
  assert.equal(ar.nav.cart, "السلة");
});
