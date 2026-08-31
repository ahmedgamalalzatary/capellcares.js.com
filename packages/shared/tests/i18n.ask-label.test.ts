import test from "node:test";
import assert from "node:assert/strict";
import { en } from "../src/i18n/en.ts";
import { ar } from "../src/i18n/ar.ts";

test("the Ask Capella launcher uses the short Ask label", () => {
  assert.equal(en.ask.button, "Ask");
  assert.equal(ar.ask.button, "اسألي");
});
